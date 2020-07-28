import ContentFile from './ContentFile';
import MsgTypes from '../consts/MsgTypes';

class ContentAudio extends ContentFile {
    constructor(contentObj) {
        super(contentObj);
        this.msgtype = MsgTypes.mAudio;
    }

    get fileURI() {
        return `file://${this.appURI}`;
    }

    get timeline() {
        return Object.prototype.hasOwnProperty.call(this.info, 'duration') && Number.isInteger(parseInt(this.info.duration, 10)) ? parseInt(this.info.duration, 10) : 0;
    }

    mmss = (milisecs) => {
        const secs = Math.floor(milisecs / 1000);
        const minutes = Math.floor(secs / 60);
        const seconds = secs % 60;
        // const miliseconds = Math.floor((milisecs % 1000) / 10);
        return `${this.pad(minutes)}:${this.pad(seconds)}`;
    }

    pad = num => (`0${num}`).slice(-2)
}

export default ContentAudio;
