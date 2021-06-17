import path from 'path';
import createAxiosError from 'axios/lib/core/createError'; // eslint-disable-line import/no-extraneous-dependencies
import fs from 'fs-extra';
import { load } from '../utils';
import { testsRootFolder } from '../constants';
import PAGES from './fixtures/confluence/pages-list.json';
import longTaskFinished from './fixtures/confluence/longtask-finished.json';
import longTaskUnFinished from './fixtures/confluence/longtask-unfinished.json';

const CONFLUENCE_API = load('ConfluenceApi').default;

function axiosResponse(data) {
    return { data: JSON.parse(JSON.stringify(data)) };
}

function axiosError(opts, { message, code }, data) {
    return createAxiosError(message, opts, code, {}, { data });
}

class CONFLUENCE_MOCK_API extends CONFLUENCE_API {
    async _axios(opts) {
        if (opts.url.match('/content')) {
            if (opts.url.match('space_404')) {
                throw axiosError(opts, {
                    message : 'Request failed with status code 404'
                }, {
                    statusCode : 404,
                    message    : 'com.atlassian.confluence.api.service.exceptions.NotFoundException: No space found with key : space_404',
                    data       : { authorized: false, valid: true, errors: [], successful: false }
                });
            }

            const { start } = opts.params;

            if (start) {
                return axiosResponse({
                    ...PAGES,
                    page : {
                        results : [],
                        size    : 0
                    }
                });
            }

            return axiosResponse(PAGES);
        }

        if (opts.url.match('longtask')) {
            if (!this.__longTaskFired) this.__longTaskFired = 0;
            this.__longTaskFired++;
            if (this.__longTaskFired === 1) return  axiosResponse(longTaskUnFinished);
            if (this.__longTaskFired === 2) {
                this.__longTaskFired = 0;

                return axiosResponse(longTaskFinished);
            }
        }

        if (opts.url.match('pdfpageexport')) {
            const htmlFilePath = path.join(testsRootFolder, 'mock/fixtures/confluence/pdfexport.html');
            const html = await fs.readFile(htmlFilePath);
            const error = axiosError(opts, {
                message : 'Request failed with status code 403'
            });

            error.response = {
                status  : 403,
                headers : { 'content-type': 'text/html' },
                data    : html.toString()
            };

            throw error;
        }

        if (opts.url.match('download/temp/filestore')) {
            const samplePdfPath = path.join(testsRootFolder, 'mock/fixtures/confluence/sample.pdf');

            return {
                data : fs.createReadStream(samplePdfPath)
            };
        }

        return axiosResponse(1);
    }
}

const methods = Object.getOwnPropertyNames(CONFLUENCE_MOCK_API.prototype).filter(m => m !== 'constructor');

for (const methodName of methods) {
    CONFLUENCE_API.prototype[methodName] = CONFLUENCE_MOCK_API.prototype[methodName];
}
