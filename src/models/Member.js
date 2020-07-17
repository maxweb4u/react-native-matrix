/**
 * Created by Max Gor on 6/20/20
 *
 * This is user class
 */

import * as sdk from 'matrix-js-sdk';
import Utils from '../lib/utils';
import api from '../api';

class Member {
    userId = null;

    presence = '';

    displayName = '';

    mxcURI = '';

    serverName = '';

    mediaId = '';

    source = null;

    constructor(matrixUser) {
        if (matrixUser) {
            this.userId = matrixUser.userId;
            this.presence = matrixUser.presence;
            this.displayName = matrixUser.displayName;
            this.mxcURI = matrixUser.avatarUrl;
            const { serverName, mediaId } = Utils.parseMXCURI(this.mxcURI);
            this.serverName = serverName;
            this.mediaId = mediaId;
        }
    }

    get httpURL() {
        return `${api.auth.getBaseURL() + sdk.PREFIX_MEDIA_R0}/download/${this.serverName}/${this.mediaId}`;
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
}

export default Member;
