/**
 * Created by Max Gor on 6/20/20
 *
 * This is a library for Matrix logic
 */
import './lib/poly.js';
import * as sdk from "matrix-js-sdk";

class Matrix {
    static instance;

    client = null;

    syncCallback = null;

    static getInstance() {
        if (!Matrix.instance) {
            Matrix.instance = new Matrix();
        }
        return Matrix.instance;
    }

    initClient(baseUrl, accessToken, userId) {
        this.client = sdk.createClient({ baseUrl, accessToken, userId });
    }

    async startClient(syncTime) {
        await this.client.startClient({initialSyncLimit: syncTime});
    }

    sync() {
        this.client.once('sync', (state, prevState, res) => {
            console.log("SYNC", state, prevState, res);
            if(state === 'PREPARED') {
                if (this.syncCallback) {
                    this.syncCallback(res);
                }
            }
        });
    }

    getRooms() {
        const rooms = this.client.getRooms()
        console.log("-------------------------ROOMS", rooms);
        return rooms;
    }
}

export default Matrix.getInstance();
