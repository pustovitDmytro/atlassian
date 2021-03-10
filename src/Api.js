import { URL } from 'url';
import os from 'os';
import axios from 'axios';
import ms from 'ms';
import uuid from 'uuid';
import defaultLogger from './logger';

function resolveUrl(base, relativeUrl) {
    const baseUrl = base ? new URL(base) : undefined;
    const absoluteUrl = new URL(relativeUrl, baseUrl);

    if (absoluteUrl.href === relativeUrl) {
        return new URL(absoluteUrl,  baseUrl);
    }

    const apiPrefix = baseUrl?.pathname;

    const relPath = (apiPrefix && apiPrefix !== '/')
        ? apiPrefix + absoluteUrl.pathname
        : relativeUrl;

    return new URL(relPath,  baseUrl);
}

export class API_ERROR extends Error {
    #payload

    constructor(error) {
        super(error.message);
        Error.captureStackTrace(this, this.constructor);
        this.#payload = error;
    }

    get name() {
        return this.constructor.name;
    }

    toString() {
        const message = super.toString();
        const inner  = this.#payload.response?.data;

        if (inner.message) return [ message, inner.message ].join(os.EOL);

        if (inner?.errorMessages?.length) {
            return [ message, ...inner.errorMessages ].join(os.EOL);
        }

        return message;
    }
}

export default class API {
    constructor(url, auth, { timeout = '1m' } = {}) {
        this.url = new URL(url);
        this.auth = auth;
        this.timeout = ms(timeout);
        this.initLogger();
    }

    initLogger(logger = defaultLogger) {
        this.logger = logger;
    }

    onError(error) {
        if (error.isAxiosError) throw new API_ERROR(error);
        throw error;
    }

    onResponse(res) {
        return res.data;
    }

    _getUrl(relativeUrl) {
        return resolveUrl(this.url, relativeUrl);
    }

    _getHeaders() {
        return {
            'Content-Type' : 'application/json',
            'Accept'       : 'application/json'
        };
    }

    async _axios(axiosOptions) {
        return axios(axiosOptions);
    }

    getTraceId({ traceId }) {
        return traceId || uuid.v4();
    }

    async request(method, url, reqOptions = {}, settings = {}) {
        const { headers, data, params, ...options } = reqOptions;
        const traceId = this.getTraceId(settings);

        this.logger.log('debug', { method, url, ...reqOptions, api: this.constructor.name, traceId, type: 'requestSent' });
        const axiosOptions = {
            timeout : this.timeout,
            method,
            url     : this._getUrl(url).href,
            headers : headers || this._getHeaders(),
            data    : data || {},
            params  : params || {},
            auth    : this.auth,
            ...options
        };

        try {
            const response = await this._axios(axiosOptions);

            this.logger.log('verbose', { traceId, type: 'responseReceived', data: response.data });

            const handleResponse = settings.onResponse || this.onResponse;

            return handleResponse(response);
        } catch (error) {
            this.logger.log('verbose', { traceId, error: error.toString(), data: error.response?.data, stack: error.stack, type: 'errorOccured' });
            const onError = settings.onError || this.onError;

            onError(error);
        }
    }

    get(url, params, options = {}) {
        return this.request('GET', url, {
            params,
            ...options
        });
    }

    post(url, data, options = {}) {
        return this.request('POST', url, {
            data,
            ...options
        });
    }

    async mock() {
        return { data: 1 };
    }
}
