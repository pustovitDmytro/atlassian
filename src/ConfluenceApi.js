import Api from './AtlassianApi';
import { dumpPage } from './utils/dumpUtils';

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
}
