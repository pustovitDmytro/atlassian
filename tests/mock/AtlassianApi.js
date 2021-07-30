import { getNamespace } from 'cls-hooked';
import createAxiosError from 'axios/lib/core/createError'; // eslint-disable-line import/no-extraneous-dependencies
import { apiLogger } from '../logger';
import { load } from '../utils';
import user from './fixtures/atlassian/user.json';

const ATLASSIAN_API = load('api/AtlassianApi').default;

export function axiosResponse(data) {
    return { data: JSON.parse(JSON.stringify(data)) };
}

export function axiosError(opts, { message, code }, data) {
    return createAxiosError(message, opts, code, {}, { data });
}

export default class API extends ATLASSIAN_API {
    async _axios(opts) {
        if (opts.url.match('/rest/api/3/myself')) return axiosResponse(user);

        return axiosResponse(1);
    }

    getTraceId() {
        return getNamespace('__TEST__').get('current').id;
    }

    initLogger() {
        this._logger = this.logger =  apiLogger;
    }
}

const methods = Object.getOwnPropertyNames(API.prototype).filter(m => m !== 'constructor');

for (const methodName of methods) {
    ATLASSIAN_API.prototype[methodName] = API.prototype[methodName];
}
