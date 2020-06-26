import Content from './Content';

class ContentText extends Content {
    msgtype = 'm.text';

    constructor(contentObj) {
        super(contentObj);
    }
}

export default ContentText;
