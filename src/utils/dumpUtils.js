import { flatten } from 'myrmidon';

const MS_TO_SEC = 1000;

// JIRA

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

        worklog  : issue._worklog || issue.fields.worklog?.worklogs.map(w => dumpWorklog(w)) || [],
        comments : issue._comments || issue.fields.comment?.comments.map(c => dumpComment(c)) || [],
        history  : history
            .filter(({ item }) => {
                return item.field === 'status';
            })
            .map(h => dumpHistory(h)),
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
        id     : w.id,
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

export function dumpSprint(s) {
    return {
        id    : s.id,
        state : s.state, // closed, future, active
        name  : s.name,
        goal  : s.goal,

        startDate    : s.startDate,
        endDate      : s.endDate,
        completeDate : s.completeDate

    };
}


export function dumpStatus(s) {
    return {
        id       : s.id,
        name     : s.name,
        // eslint-disable-next-line censor/no-swear
        category : s.statusCategory.name
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

// Confluence

export function dumpPage(p) {
    return {
        id     : p.id,
        type   : p.type,
        status : p.status,
        title  : p.title
    };
}

export function dumpLongTask(t) {
    return {
        id : t.id,

        elapsedTime        : t.elapsedTime,
        percentageComplete : t.percentageComplete,
        successful         : t.successful,
        finished           : t.finished,

        text : t.messages?.[0].translation
    };
}
