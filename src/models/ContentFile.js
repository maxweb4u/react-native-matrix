import * as sdk from 'matrix-js-sdk';
import Content from './Content';
import MsgTypes from '../consts/MsgTypes';
import FileUtils from '../lib/fileUtils';
import Utils from '../lib/utils';
import api from '../api';

class ContentFile extends Content {
    body = '';

    filename = '';

    msgtype = MsgTypes.mFile;

    mxcURI = '';

    appURI = '';

    serverName = '';

    mediaId = '';

    info = { mimetype: '', size: 0 };

    source = null;

    /*
    * contentobj = {
    *   body: A human-readable description of the file
    *   filename: filename
    *   info: FileInfo - { mimetype: '', size: 0 };
    *   msgtype: 'm.file'
    *   url: mxcURI
    *   uri: appURI
    *   source: base64 source string
    * }
    *
    */
    constructor(contentobj) {
        super(contentobj);
        Object.keys(contentobj).map(field => this[field] = contentobj[field]);
        this.mxcURI = contentobj.url || '';
        this.appURI = contentobj.uri || '';
        const { serverName, mediaId } = Utils.parseMXCURI(this.mxcURI);
        this.serverName = serverName;
        this.mediaId = mediaId;
    }

    get title() {
        return this.body && this.body.length > 20 ? `${this.body.substr(0, 17)}... .${this.body.substr(-3, 3)}` : this.body;
    }

    get dataStringForURI() {
        return `data:${this.info.mimetype};base64,${this.source}`;
    }

    get infoTitle() {
        let ret = this.info.size ? FileUtils.formatBytes(this.info.size) : '';
        if (this.info.mimetype) {
            if (this.info.size) {
                ret += ' | ';
            }
            ret += FileUtils.formatFileMimeType(this.info.mimetype);
        }
        return ret;
    }

    get matrixContentObj() {
        return { msgtype: this.msgtype, body: this.body, url: this.mxcURI, info: this.info };
    }

    get httpURL() {
        return api.auth.getBaseURL() + sdk.PREFIX_MEDIA_R0 + `/download/${this.serverName}/${this.mediaId}`;
    }

    get base64ForShare() {
        return `data:${this.mimeType};base64,${this.source}`;
    }

    get mimeType() {
        return this.info.mimetype;
    }

    async getFile() {
        if (this.source) {
            return { status: true, data: this.source };
        }
        if (this.serverName && this.mediaId) {
            const res = await api.media.downloadFile(this.serverName, this.mediaId);
            if (res.status) {
                this.source = res.data;
                return { status: true, data: this.source };
            }
        }
        return { status: false };
    }

    async uploadFile() {
        if (this.body && this.info.mimetype && this.source) {
            const res = await await api.media.uploadFile(this.body, this.info.mimetype, this.source);
            if (res.status) {
                this.mxcURI = res.data.content_uri;
                const { serverName, mediaId } = Utils.parseMXCURI(res.data.content_uri);
                this.serverName = serverName;
                this.mediaId = mediaId;
                return res;
            }
        }
        return { status: false };
    }

    async saveFile() {
        if (this.body && this.info.mimetype && this.source) {
            const uri = await FileUtils.saveFile(this.body, this.source);
            if (uri) {
                this.appURI = uri;
                return { status: true, uri };
            }
        }
        return { status: false };
    }

    static makeMessageObj(msgtype, filename, uri, mimetype, base64, size, duration) {
        const obj = { msgtype, body: filename, filename, info: { mimetype }, uri };
        if (size) {
            obj.info.size = size;
        }
        if (base64) {
            obj.source = base64;
        }
        if (duration) {
            obj.info.duration = duration;
        }
        return obj;
    }
}

export default ContentFile;
