
class Node {
    constructor(node, parent) {
        this.node = node;
        this.type = node.type;
        this.children = node.content || [];
        if (this.parent) {
            this.parent = parent;
            this.level = this.parent + 1;
        }

        this.level = 0;
    }
}

class Visitor {
    hasHandler(type) {
        return this.[type];
    }

    accum() {}

    call(node) {
        if (this.hasHandler(node.type)) {
            this.accum(
                this[node.type](node),
                node
            );
        }
    }
}

class ADFTextVisitor extends Visitor {
    accum(parsed) {
        if (!this.result) this.result = '';
        this.result += parsed;
    }

    text({ node }) {
        return `${node.text}`;
    }

    hardBreak() {
        return '\n';
    }

    paragraph() {
        return '\n\n';
    }

    mediaGroup() {
        return '\nMedia:';
    }

    media({ node }) {
        return `\n[${node.attrs.type}] ${node.attrs.id}`;
    }

    // https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/
    parseADF(node, parent) {
        const adf = new Node(node, parent);

        this.call(adf);

        for (const childNode of adf.children) {
            this.parseADF(childNode, adf);
        }

        return this.result;
    }
}

export function adfToText(root) {
    if (!root) return '';
    const visitor = new ADFTextVisitor();

    return visitor.parseADF(root);
}
