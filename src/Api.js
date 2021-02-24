
import { URL } from 'url';
import axios from 'axios';
import ms from 'ms';

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
    constructor(error) {
        super(error.message);
        this._payload = error;
    }
}

export default class API {
    constructor(url, auth, { timeout = '1m' } = {}) {
        this.url = new URL(url);
        this.auth = auth;
        this.timeout = ms(timeout);
    }

    onError(error) {
        if (error.isAxiosError) throw new API_ERROR(error.toJSON());
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

    async request(method, url, reqOptions = {}, settings = {}) {
        const { headers, data, params, ...options } = reqOptions;

        if (this.isMock) {
            if (this.log) this.log({ method, url, ...reqOptions, api: this.constructor.name });

            return;
        }

        try {
            const response = await axios({
                timeout : this.timeout,
                method,
                url     : this._getUrl(url).href,
                headers : headers || this._getHeaders(),
                data    : data || {},
                params  : params || {},
                auth    : this.auth,
                ...options
            });

            const handleResponse = settings.onResponse || this.onResponse;

            return handleResponse(response);
        } catch (error) {
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
}
