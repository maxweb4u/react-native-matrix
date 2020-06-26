/**
 * Created by Max Gor on 6/20/20
 *
 * This is model for matrix event
 */

import Content from './Content';
import ContentText from './ContentText';

class Event {
    matrixEvent = null;

    contentObj = null;

    constructor(matrixEvent) {
        if (matrixEvent) {
            this.matrixEvent = matrixEvent;
            switch (this.matrixEvent.getType()) {
                case 'm.room.message':
                    const content = this.matrixEvent.getContent();
                    switch (content.msgtype) {
                        case 'm.text': this.contentObj = new ContentText(content); break;
                        default: this.contentObj = new Content(content); break;
                    }
                    break;
                default:
                    this.contentObj = new Content();
                    break;
            }
        }
    }

    get message() {
        if (!this.contentObj) {
            return '';
        }
        return this.contentObj.message;
    }

    get messageOnly() {
        if (!this.contentObj) {
            return '';
        }
        return this.contentObj.messageOnly;
    }

    get ts() {
        if (!this.matrixEvent) {
            return Number.MIN_SAFE_INTEGER;
        }
        return this.matrixEvent.getTs();
    }
}

export default Event;
