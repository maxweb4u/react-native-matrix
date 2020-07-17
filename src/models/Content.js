/**
 * Created by Max Gor on 6/20/20
 *
 * This is general class for all content objects
 */

import MsgTypes from '../consts/MsgTypes';

class Content {
    body = '';

    msgtype = MsgTypes.mGeneral;

    isQuote = false;

    constructor(contentObj) {
        if (contentObj) {
            Object.keys(contentObj).map(field => this[field] = contentObj[field]);
        }
    }

    get message() {
        return this.body ? this.body : '';
    }

    get quoteMessageObj() {
        const arr = this.message.split('\n');
        const ret = { quote: '', message: '' };
        arr.map((val) => {
            if (val.indexOf('> ') !== -1) {
                ret.quote += `${val.replace('> ', '')}\n`;
            } else {
                ret.message += val;
            }
        });
        if (ret.quote.length > 0) {
            ret.quote = ret.quote.slice(0, -1);
        }
        return ret;
    }

    get messageOnly() {
        if (this.isQuote) {
            const { quoteMessageObj } = this;
            return quoteMessageObj.message;
        }
        return this.message;
    }

    get type() {
        return this.msgtype;
    }

    get quoteText() {
        if (this.messageOnly.indexOf('> ') !== -1) {
            return messageOnly;
        }
        return `> ${this.messageOnly.replace(/(?:\r\n|\r|\n)/g, '\n> ')}\n\n`;
    }
}

export default Content;
