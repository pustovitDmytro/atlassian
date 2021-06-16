import path from 'path';
import fs from 'fs-extra';
// eslint-disable-next-line import/no-extraneous-dependencies
import axios from 'axios';
import { htmlToText } from 'html-to-text';
import { pause } from 'myrmidon';
import Api from './ConfluenceApi';

function onError(error) {
    console.error(error.response ? error.response.data : error);
    throw error;
}

const CONFLUENCE_LOG_POLLING_INTERVAL = 500;

export default class Confluence extends Api {
    constructor(config, logger) {
        super(config.host, {
            username : config.email,
            password : config.token
        });
        this.userId = config.userId;
        this.host = config.host;
        this.initLogger(logger);
    }

    async getPages(space) {
        return this.pagesList(space);
    }

    async exportPage(pageId, filename) {
        const res = await axios.get(`${this.host}/wiki/spaces/flyingpdf/pdfpageexport.action?pageId=${pageId}`, {
            auth : this.auth
        }).catch(error => {
            if (error.response.headers['content-type'].match('text/html')) {
                const text = htmlToText(error.response.data);

                if (text.match('PDF EXPORT - IN PROGRESS')) {
                    const taskId = error.response.data.match(/ajs-taskid.*content="(\d+)/i)[1];

                    return { status: 1, text, taskId };
                }
            }

            throw error;
        });

        // console.log(res.taskId, res.text);
        const longRes = await axios.get(`${this.host}/wiki/rest/api/longtask/${res.taskId}`, {
            auth : this.auth
        }).catch(onError);

        let task = longRes.data;

        while (!task.finished) {
            await pause(CONFLUENCE_LOG_POLLING_INTERVAL);
            const longIterRes = await axios.get(`${this.host}/wiki/rest/api/longtask/${res.taskId}`, {
                auth : this.auth
            }).catch(onError);

            task = longIterRes.data;
        }

        const downloadUrl = task.messages[0].translation
            .match(/<a class="space-export-download-path" href="([^">]*)">/i)[1];
        const filePath = path.resolve(filename);
        const writer = fs.createWriteStream(filePath);

        console.log(`${this.host}${downloadUrl}`);
        const response = await axios.get(`${this.host}${downloadUrl}`, {
            auth         : this.auth,
            responseType : 'stream'
        });

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        console.log(`written to ${filePath}`);

        return filePath;
    }
}
