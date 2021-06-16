// import createAxiosError from 'axios/lib/core/createError'; // eslint-disable-line import/no-extraneous-dependencies
import { load } from '../utils';
import PAGES from './fixtures/confluence/pages-list.json';

const CONFLUENCE_API = load('ConfluenceApi').default;

function axiosResponse(data) {
    return { data: JSON.parse(JSON.stringify(data)) };
}

// function axiosError(opts, { message, code }, data) {
//     return createAxiosError(message, opts, code, {}, { data });
// }

class CONFLUENCE_MOCK_API extends CONFLUENCE_API {
    async _axios(opts) {
        if (opts.url.match('/content')) {
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

        return axiosResponse(1);
    }
}

const methods = Object.getOwnPropertyNames(CONFLUENCE_MOCK_API.prototype).filter(m => m !== 'constructor');

for (const methodName of methods) {
    CONFLUENCE_API.prototype[methodName] = CONFLUENCE_MOCK_API.prototype[methodName];
}
