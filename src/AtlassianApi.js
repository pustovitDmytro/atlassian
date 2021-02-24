
import Api from './Api';
import { dumpUser } from './dumpUtils';

export default class AtlassianApi extends Api {
    async getMyself() {
        const res = await this.get('/rest/api/3/myself');

        return dumpUser(res);
    }
}
