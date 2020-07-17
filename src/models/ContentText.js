import Content from './Content';
import ConstValues from '../consts';
import MsgTypes from '../consts/MsgTypes';
import Utils from '../lib/utils';

class ContentText extends Content {
    msgtype = MsgTypes.mText;

    isQuote = false;

    constructor(contentObj) {
        super(contentObj);
        if (contentObj && contentObj.format && contentObj.format === ConstValues.customHTML && contentObj.formatted_body && contentObj.formatted_body.indexOf('<blockquote>') !== -1) {
            this.isQuote = true;
        }
    }

    get matrixContentObj() {
        return ContentText.makeMessageObj(this.body, this.isQuote);
    }

    static makeMessageObj(body, isQuote) {
        return isQuote ? ContentText.makeHtmlMessageObj(body, Utils.convertMessageToQuoteHTML(body)) : ContentText.makeTextMessageObj(body);
    }

    static makeTextMessageObj(body) {
        return {
            msgtype: MsgTypes.mText,
            body,
        };
    }

    static makeHtmlMessageObj(body, htmlBody) {
        return {
            msgtype: MsgTypes.mText,
            format: ConstValues.customHTML,
            body,
            formatted_body: htmlBody,
        };
    }
}

export default ContentText;
