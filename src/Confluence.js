import path from 'path';
import fs from 'fs-extra';
import { pause } from 'myrmidon';
import Api from './api/ConfluenceApi';

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

    async resolveLongTask(taskId) {
        const task = await this.getLongTask(taskId);

        if (task.finished) return task;
        await pause(CONFLUENCE_LOG_POLLING_INTERVAL);

        return this.resolveLongTask(taskId);
    }

    async exportPage(pageId, filename) {
        const pdfpageexport = await this.pdfpageexport(pageId);

        if (!pdfpageexport?.taskId) throw new Error('Task has not been started by pdfpageexport');

        const task = await this.resolveLongTask(pdfpageexport.taskId);
        const downloadUrl = task.text.match(/<a class="space-export-download-path" href="([^">]*)">/i)[1];
        const filePath = path.resolve(filename);
        const writer = fs.createWriteStream(filePath);

        this.logger.log('verbose', { downloadUrl: `${this.host}${downloadUrl}` });

        const stream = await this.downloadFile(downloadUrl);

        stream.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        this.logger.log('info', `written to ${filePath}`);

        return filePath;
    }
}
