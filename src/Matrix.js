/**
 * Created by Max Gor on 6/20/20
 *
 * This is a library for Matrix logic
 */
import './lib/poly.js';
import * as sdk from 'matrix-js-sdk';
import api from './api';
import Room from './models/Room';
import EventTypes from './consts/EventTypes';

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
    //     this.client.on('sync', (state, prevState, res) => {
    //         console.log("state", state)
    //     });
    // }

    getRoomsForChatsList() {
        if (this.client) {
            const arr = this.client.getVisibleRooms();
            const rooms = {};
            const userIdsDM = {};
            arr.forEach((matrixRoom) => {
                const room = new Room({ matrixRoom });
                rooms[matrixRoom.roomId] = room;
                if (room.isDirect) {
                    userIdsDM[room.userIdDM] = room.id;
                }
            });
            return { rooms, userIdsDM };
        }
        return {rooms: {}, userIdsDM: {}};
    }

    getRoom({roomId, matrixRoom, possibleEventsTypes, possibleContentTypes}) {
        if (!matrixRoom && roomId) {
            matrixRoom = this.client.getRoom(roomId);
        }
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
        const options = { invite: inviteIds, preset, is_direct: isDirect };
        if (name) {
            options.name = name;
        }
        const res = await api.room.create(options);
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

    async sendEvent(roomId, eventType, contentObj, callback) {
        if (roomId) {
            return this.client.sendEvent(roomId, eventType, contentObj, callback);
        }
        return null;
    }

    async sendReaction(roomId, contentReactionObj, callback) {
        this.sendEvent(roomId, EventTypes.mRoomReaction, contentReactionObj, callback);
    }

    async loadEarlyMessages(room, limit) {
        return this.client.scrollback(room, limit).then(res => res).catch(e => e);
    }

    async changeRoom(title) {
        const res = await api.room.create(options);
        return res;
    }
}

export default Matrix.getInstance();
