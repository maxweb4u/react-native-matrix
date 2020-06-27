import Content from './Content';
import MsgTypes from '../consts/MsgTypes';

class ContentText extends Content {
    msgtype = MsgTypes.mText;

    constructor(contentObj) {
        super(contentObj);
    }
}

export default ContentText;
