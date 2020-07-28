import * as sdk from 'matrix-js-sdk';
import RNFetchBlob from 'rn-fetch-blob';
import base64 from 'base64-arraybuffer';
import codes from './codes';
import client from './axios';

class Handling {
    static async request(method, path, data, params, isNotSecure) {
        const url = sdk.PREFIX_R0 + path;
        const conf = { method, url, secure: !isNotSecure };
        if (data) {
            conf.data = data;
        }
        if (!isNotSecure) {
            params = params ? { ...params, access_token: Handling.getAccessToken() } : { access_token: Handling.getAccessToken() };
        }
        if (params) {
            conf.params = params;
        }
        const response = await Handling.getResponse(conf, true);

        return Handling.processResponse(response);
    }

    static async getResponse(conf) {
        try {
            const result = await client.request(conf);
            return Handling.success(result);
        } catch (e) {
            return Handling.error(e);
        }
    }

    static async processResponse(res) {
        switch (res.code.toString()) {
            case codes.statusOK:
            case codes.statusNoContent:
                return res;
            default:
                res.status = false;
                return res;
        }
    }


    static error(error) {
        const code = Object.prototype.hasOwnProperty.call(error, 'status') ? error.status : codes.statusInternalError;
        const data = Object.prototype.hasOwnProperty.call(error, 'data') ? error.data : {};
        const msg = Object.prototype.hasOwnProperty.call(data, 'error') ? data.error : 'error';
        const errorCode = Object.prototype.hasOwnProperty.call(data, 'errcode') ? data.errorCode : codes.errorCodeUNKNOWN;
        return { status: false, code, data, msg, errorCode };
    }

    static success(res) {
        if (res && Object.prototype.hasOwnProperty.call(res, 'status')) {
            const data = Object.prototype.hasOwnProperty.call(res, 'data') && res.data ? res.data : {};
            const code = res.status ? res.status.toString() : codes.statusInternalError;
            return { status: true, code, data, msg: '', errorCode: codes.errorCodeNONE };
        }
        return Handling.error({});
    }

    static async requestFile(path) {
        const url = Handling.getBaseURL() + sdk.PREFIX_MEDIA_R0 + path;
        const headers = { accessToken: Handling.getAccessToken() };
        return RNFetchBlob.config({ timeout: 20000 }).fetch('GET', url, headers).then((res) => {
            const { status } = res.info();
            const response = { status, data: '' };
            if (status.toString() === codes.statusOK) {
                response.status = true;
                response.data = res.base64();
                response.code = codes.statusOK;
            }
            return Handling.processResponse(response);
        }).catch((errorMessage) => {
            const response = Handling.error(errorMessage);
            return Handling.processResponse(response);
        });
    }

    static async uploadFile(path, type, data) {
        try {
            const url = Handling.getBaseURL() + sdk.PREFIX_MEDIA_R0 + path;
            const result = await client.post(url, base64.decode(data), { headers: { Authorization: `Bearer ${Handling.getAccessToken()}`, accessToken: Handling.getAccessToken(), 'Content-Type': type } });
            return Handling.success(result);
        } catch (e) {
            return Handling.error(e);
        }
    }

    static getAccessToken() {
        return client.defaults.headers.common.accessToken;
    }

    static setAccessToken(token) {
        client.defaults.headers.common.accessToken = token;
        return true;
    }

    static setBaseURL(baseURL) {
        client.defaults.baseURL = baseURL;
        return true;
    }

    static getBaseURL() {
        return client.defaults.baseURL;
    }
}

export default Handling;
