import path from 'path';
import fs from 'fs-extra';
import axios from 'axios';
import { htmlToText } from 'html-to-text';
import { pause } from 'myrmidon';

function onError(error) {
    console.error(error.response ? error.response.data : error);
    throw error;
}

const CONFLUENCE_LOG_POLLING_INTERVAL = 500;

export default class Confluence {
    constructor(config) {
        this.userId = config.userId;
        this.host = config.host;
        this.auth = {
            username : config.email,
            password : config.token
        };
    }

    async getPages(space) {
        const res =  await axios.get(`${this.host}/wiki/rest/api/space/${space}/content?expand=body.storage`, {
            auth : this.auth
        }).catch(onError);

        return res.data.page.results;
    }

    async printPages() {
        const pages = await this.getPages();

        pages.forEach(p => console.log(`${p.id}: ${p.title}`));
    }

    async exportPage(pageId, filename) {
        const res = await axios.get(`${this.host}/wiki/spaces/flyingpdf/pdfpageexport.action?pageId=${pageId}`, {
            auth : this.auth
        }).catch(err => {
            if (err.response.headers['content-type'].match('text/html')) {
                const text = htmlToText(err.response.data);

                if (text.match('PDF EXPORT - IN PROGRESS')) {
                    const taskId = err.response.data.match(/ajs-taskId.*content="(\d+)/i)[1];

                    return { status: 1, text, taskId };
                }
            }

            throw err;
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
