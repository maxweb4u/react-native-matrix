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

    get constCustomHTML() {
        return 'org.matrix.custom.html';
    }

    initClient(baseUrl, accessToken, userId) {
        this.client = sdk.createClient({ baseUrl, accessToken, userId });
    }

    async startClient(syncTime) {
        await this.client.startClient({ initialSyncLimit: syncTime });
        this.client.on('Room.timeline', (event, room, toStartOfTimeline) => {
            if (this.syncCallback) {
                this.syncCallback(event, room, toStartOfTimeline);
            }
        });
    }

    stopClient() {
        this.removeSyncCallback();
        this.client.stopClient();
    }

    setSyncCallback = syncCallback => this.syncCallback = syncCallback;

    removeSyncCallback = () => this.setSyncCallback(null);

    sync() {
        this.client.once('sync', (state, prevState, res) => {
            if (state === 'PREPARED') {
                if (this.syncCallback) {
                    this.syncCallback(res);
                }
            }
        });
    }

    getRooms() {
        const arr = this.client.getVisibleRooms();
        const rooms = {};
        arr.forEach((room) => {
            rooms[room.roomId] = new Room(room);
        });
        return rooms;
    }
}

export default Matrix.getInstance();
