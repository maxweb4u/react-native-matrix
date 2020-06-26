import Content from './Content';

class ContentText extends Content{
    body = '';

    msgtype = 'm.text';

    isQuote = false;

    constructor(contentobj) {
        super(contentobj);

        // if (format === Matrix.constCustomHTML && formattedBody.indexOf('<blockquote>') !== -1) {
        //     this.isQuote = true;
        //     this.msgtype = 'm.quote';
        // }
    }

    get message() {
        return this.body ? this.body : '';
    }
}

export default ContentText;
