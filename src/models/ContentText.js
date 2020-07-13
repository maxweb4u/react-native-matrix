import Content from './Content';
import MsgTypes from '../consts/MsgTypes';
import Utils from '../lib/utils';

class ContentText extends Content {
    msgtype = MsgTypes.mText;

    isQuote = false;

    constructor(contentObj) {
        super(contentObj);
    }

    get matrixContentObj() {
        return ContentText.makeMessageObj(this.body, this.isQuote);
    }

    static makeMessageObj(body, isQuote) {
        return isQuote ? ContentText.makeHtmlMessageObj(body, Utils.convertMessageToQuoteHTML(body)) : ContentText.makeTextMessageObj(body)
    }

    static makeTextMessageObj(body) {
        return {
            msgtype: MsgTypes.mText,
            body: body
        };
    }

    static makeHtmlMessageObj(body, htmlBody) {
        return {
            msgtype: MsgTypes.mText,
            format: "org.matrix.custom.html",
            body: body,
            formatted_body: htmlBody
        };
    }
}

export default ContentText;
