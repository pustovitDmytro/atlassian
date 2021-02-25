
import Api from './AtlassianApi';
import { dumpStatus } from './dumpUtils';

export default class JiraApi extends Api {
    async getStatuses() {
        const res = await this.get('/rest/api/latest/status/');

        return res.map(dumpStatus);
    }
}
