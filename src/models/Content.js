/**
 * Created by Max Gor on 6/20/20
 *
 * This is general class for all content objects
 */

import Matrix from '../Matrix';
import MsgTypes from '../consts/MsgTypes';

class Content {
    body = '';

    msgtype = MsgTypes.mGeneral;

    isQuote = false;

    constructor(contentObj) {
        if (contentObj) {
            Object.keys(contentObj).map(field => this[field] = contentObj[field]);
            if (contentObj.format && contentObj.format === Matrix.constCustomHTML && contentObj.formatted_body && contentObj.formatted_body.indexOf('<blockquote>') !== -1) {
                this.isQuote = true;
            }
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
}

export default Content;
