import ContentFile from './ContentFile';
import MsgTypes from '../consts/MsgTypes';

class ContentImage extends ContentFile {
    constructor(contentObj) {
        super(contentObj);
        this.msgtype = MsgTypes.mImage;
    }

    async getFile() {
        if (this.appURI) {
            return { status: true, data: this.appURI };
        }

        const res = await super.getFile();
        if (res.status) {
            return { status: true, data: this.dataStringForURI };
        }

        return { status: false };
    }
}

export default ContentImage;
