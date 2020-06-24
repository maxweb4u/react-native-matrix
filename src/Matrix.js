/**
 * Created by Max Gor on 6/20/20
 *
 * This is a library for Matrix logic
 */

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

    constructor(baseUrl, accessToken, userId) {
        this.client = sdk.createClient({ baseUrl, accessToken, userId });
    }

    async startClient(syncTime) {
        await this.client.startClient({initialSyncLimit: syncTime});
        this.sync();

    }

    sync() {
        this.client.once('sync', (state, prevState, res) => {
            console.log(state);
            if(state === 'PREPARED') {
                if (this.syncCallback) {
                    this.syncCallback(res);
                }
            }
        });
    }

    getRooms() {
        const rooms = this.client.getRooms()
        console.log(rooms);
        return rooms;
    }
}

export default Sync.getInstance();
