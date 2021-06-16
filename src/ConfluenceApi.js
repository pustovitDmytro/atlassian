import { htmlToText } from 'html-to-text';
import Api, { ATLASSIAN_ERROR } from './AtlassianApi';
import { dumpPage, dumpLongTask } from './utils/dumpUtils';

export default class ConfluenceApi extends Api {
    async pagesList(space, opts = {}) {
        const {
            expandBodyStorage = true,
            limit = 10,
            start = 0
        } = opts;

        const params = { limit, start };

        if (expandBodyStorage) params.expand = 'body.storage';

        const res = await this.get(`/wiki/rest/api/space/${space}/content`,  params);
        const { results, size } = res.page;
        const pages = results.map(p => dumpPage(p));

        if (size >= limit) {
            const nextPages = await this.pagesList(space, {
                ...opts,
                start : start + limit
            });

            return [
                ...pages,
                ...nextPages
            ];
        }

        return pages;
    }

    async pdfpageexport(pageId) {
        try {
            await this.get(`${this.host}/wiki/spaces/flyingpdf/pdfpageexport.action?pageId=${pageId}`);
        } catch (error)  {
            const isGood = error instanceof ATLASSIAN_ERROR;
            const pdfpageexportStatusCode = 403;

            if (isGood) {
                const { response } = error.payload;

                if (
                    response.status === pdfpageexportStatusCode
                    && response.headers['content-type'].match('text/html')
                ) {
                    const text = htmlToText(response.data);

                    if (text.match('PDF EXPORT - IN PROGRESS')) {
                        const taskId = response.data.match(/ajs-taskid.*content="(\d+)/i)[1];

                        return { status: 1, text, taskId };
                    }
                }
            }

            throw error;
        }
    }

    async getLongTask(taskId) {
        const res = await this.get(`wiki/rest/api/longtask/${taskId}`);

        return dumpLongTask(res);
    }

    async downloadFile(downloadUrl) {
        return this.get(downloadUrl, {}, {
            responseType : 'stream'
        });
    }
}
