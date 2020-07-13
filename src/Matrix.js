/**
 * Created by Max Gor on 6/20/20
 *
 * This is a library for Matrix logic
 */
import './lib/poly.js';
import * as sdk from 'matrix-js-sdk';
import api from './api';
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

    initClient(baseUrl, accessToken, userId, displayName) {
        this.client = sdk.createClient({ baseUrl, accessToken, userId });
        api.auth.setBaseURL(baseUrl);
        api.auth.setAccessToken(accessToken);
        if (displayName) {
            this.updateDisplayName(displayName);
        }
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
        api.auth.removeAccessToken();
    }

    setSyncCallback = syncCallback => this.syncCallback = syncCallback;

    removeSyncCallback = () => this.setSyncCallback(null);

    // sync() {
    //     this.client.once('sync', (state, prevState, res) => {
    //         if (state === 'PREPARED') {
    //             if (this.syncCallback) {
    //                 this.syncCallback(res);
    //             }
    //         }
    //     });
    // }

    getRooms() {
        if (this.client) {
            const arr = this.client.getVisibleRooms();
            const rooms = {};
            arr.forEach((matrixRoom) => {
                rooms[matrixRoom.roomId] = new Room({ matrixRoom });
            });
            return rooms;
        }
        return [];

    }

    getRoom(roomId, possibleEventsTypes, possibleContentTypes) {
        const matrixRoom = this.client.getRoom(roomId);
        if (matrixRoom) {
            const room = new Room({ matrixRoom, possibleEventsTypes, possibleContentTypes });
            return room;
        }
        return null;
    }

    getIsOwn(userId) {
        return this.userId === userId;
    }

    async createRoom(inviteIds, name, isDirect, preset) {
        isDirect = isDirect || false;
        preset = preset || 'private_chat';
        const res = await api.room.create({ invite: inviteIds, name, preset, is_direct: isDirect });
        return res;
    }

    async updateDisplayName(displayName) {
        const res = await api.profile.updateDisplayName(this.userId, displayName);
        return res;
    }

    async sendMessage(roomId, contentObj, callback) {
        if (roomId) {
            return this.client.sendMessage(roomId, contentObj, callback);
        }
        return null;
    }
}

export default Matrix.getInstance();
