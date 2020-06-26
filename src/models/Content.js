/**
 * Created by Max Gor on 6/20/20
 *
 * This is general class for all content objects
 */

class Content {
    body = '';

    msgtype = 'm.general';

    constructor(contentObj) {
        if (contentObj) {
            Object.kyes(contentObj).map(field => this[field] = contentObj[field]);
        }
    }

    get message() {
        return this.body ? this.body : '';
    }
}

export default Content;
