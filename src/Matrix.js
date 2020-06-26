/**
 * Created by Max Gor on 6/20/20
 *
 * This is a library for Matrix logic
 */
import './lib/poly.js';
import * as sdk from 'matrix-js-sdk';
import Room from './models/Room';

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

    get userId() {
        if (this.client) {
            return this.client.getUserId();
        }
        return '';
    }

    initClient(baseUrl, accessToken, userId) {
        this.client = sdk.createClient({ baseUrl, accessToken, userId });
    }

    async startClient(syncTime) {
        await this.client.startClient({initialSyncLimit: syncTime});
    }

    sync() {
        this.client.once('sync', (state, prevState, res) => {
            if(state === 'PREPARED') {
                if (this.syncCallback) {
                    this.syncCallback(res);
                }
            }
        });
    }

    getRooms() {
        const arr = this.client.getRooms()
        const rooms = [];
        arr.forEach(room => {
            rooms.push(new Room(room.roomId, room.name, room));
        })
        return ret;
    }
}

export default Matrix.getInstance();
