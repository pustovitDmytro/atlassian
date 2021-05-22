import { flatten } from 'myrmidon';

const MS_TO_SEC = 1000;

export function dumpTask(issue = {}) {
    const history = issue.changelog
        ? flatten(issue.changelog.histories.map(h => h.items.map(i => ({ item: i, history: h }))))
        : [];

    return {
        id           : issue.key,
        key          : issue.key,
        project      : issue.fields.project?.name,
        created      : issue.fields.created,
        updated      : issue.fields.updated,
        assignee     : issue.fields.assignee?.accountId,
        assigneeName : issue.fields.assignee?.displayName,
        summary      : issue.fields.summary,
        description  : issue.fields.description,
        time         : issue.fields.aggregatetimespent,
        priority     : issue.fields.priority?.name,
        status       : issue.fields.status?.id,
        statusName   : issue.fields.status?.name,

        worklog  : issue._worklog || [],
        comments : issue._comments || [],
        history  : history
            .filter(({ item }) => {
                return item.field === 'status';
            })
            .map(dumpHistory),
        transitions : issue._transitions || []
    };
}

function dumpHistory(h) {
    return {
        author : h.history.author.accountId,
        date   : h.history.created,
        // from   : h.item.fromString,
        // to     : h.item.toString
        from   : h.item.from,
        to     : h.item.to
    };
}

export function dumpWorklog(w) {
    return {
        time   : w.timeSpentSeconds * MS_TO_SEC,
        author : w.author.accountId,
        start  : w.started
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

export function dumpTransition(t) {
    return {
        id   : t.id,
        name : t.name,
        to   : {
            id   : t.to.id,
            name : t.to.name
        }
    };
}

export function dumpComment(c) {
    return {
        author     : c.author.accountId,
        authorName : c.author.displayName,
        text       : c.body,
        date       : c.updated
    };
}
