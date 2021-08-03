
import Api from 'base-api-client';
import API_ERROR from 'base-api-client/lib/Error';
import { dumpUser } from '../utils/dumpUtils';
import defaultLogger from '../logger';

export class ATLASSIAN_ERROR extends API_ERROR {
    get message() {
        const messages = [ this.payload.message ];
        const inner  = this.payload.response?.data;

        if (inner?.message) {
            messages.push(inner.message);
        } else if (inner?.errorMessages?.length) {
            messages.push(...inner.errorMessages);
        } else if (inner) {
            messages.push(JSON.stringify(inner));
        }

        return messages.join(' ');
    }
}


export default class AtlassianApi extends Api {
    constructor(url, auth) {
        super(url);
        this.auth = auth;
    }

    onError(error) {
        if (error.isAxiosError) throw new ATLASSIAN_ERROR(error);
        throw error;
    }

    initLogger(logger = defaultLogger) {
        this.setLogger(logger);
    }

    setLogger(logger) {
        super.initLogger(logger);
        this.logger = logger;
    }

    async getMyself() {
        const res = await this.get('/rest/api/3/myself');

        return dumpUser(res);
    }
}
