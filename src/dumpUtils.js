import { flatten } from 'myrmidon';

export function dumpTask(issue = {}) {
    const worklogs = issue._worklogs || [];
    const comments = issue._comments || [];
    const history = issue.changelog
        ? flatten(issue.changelog.histories.map(h => h.items.map(i => ({ item: i, history: h }))))
        : [];

    return {
        key          : issue.key,
        project      : issue.fields.project.name,
        created      : issue.fields.created,
        updated      : issue.fields.updated,
        assignee     : issue.fields.assignee?.accountId,
        assigneeName : issue.fields.assignee?.displayName,
        summary      : issue.fields.summary,
        description  : issue.fields.description,
        time         : issue.fields.aggregatetimespent,
        priority     : issue.fields.priority.name,
        status       : issue.fields.status.name,

        worklog : worklogs.map(w => ({
            time   : w.timeSpentSeconds * 1000,
            author : w.author.accountId,
            start  : w.started
        })),
        comments : comments.map(c => ({
            author : c.author.accountId,
            text   : c.body,
            date   : c.updated
        })),
        transitions : history
            .filter(({ item }) => {
                return item.field === 'status';
            })
            .map(h => {
                return ({
                    author : h.history.author.accountId,
                    date   : h.history.created,
                    from   : h.item.fromString,
                    to     : h.item.toString
                });
            })
    };
}

export function dumpUser(user) {
    return {
        email : user.emailAddress,
        id    : user.accountId,
        name  : user.displayName
    };
}

export function dumpStatus(s) {
    return {
        id   : s.id,
        name : s.name
    };
}
