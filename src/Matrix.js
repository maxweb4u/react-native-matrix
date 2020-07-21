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

    timelineChatsCallback = null;

    timelineChatCallback = null;

    totalUnread = 0;

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

    get unread() {
        return this.totalUnread;
    }

    setUnread(room, roomUnread, totalUnread) {
        if (totalUnread) {
            this.totalUnread = totalUnread;
            return null;
        }
        if (room && roomUnread >= 0) {
            room.setUnread(roomUnread);
            let newUnread = this.totalUnread - roomUnread;
            if (newUnread < 0) {
                newUnread = 0;
            }
            this.totalUnread = newUnread;
        }

    }

    initClient({ baseUrl, accessToken, userId, displayName }) {
        this.client = sdk.createClient({ baseUrl, accessToken, userId });
        api.auth.setBaseURL(baseUrl);
        api.auth.setAccessToken(accessToken);
        this.updateDisplayName(displayName);
    }

    startClient(syncTime) {
        this.client.on('Room.timeline', (event, room, toStartOfTimeline) => {
            // console.log("CALBACK TIMELINE")
            if (this.timelineChatsCallback) {
                this.timelineChatsCallback(event, room, toStartOfTimeline);
            }
            if (this.timelineChatCallback) {
                this.timelineChatCallback(event, room, toStartOfTimeline);
            }
        });
        this.client.on('sync', (state, prevState, data) => {
            if (state === 'SYNCING' && data.nextSyncToken !== data.oldSyncToken) {
                // console.log(data.nextSyncToken, data.oldSyncToken)
            }
        });
        // this.client.startClient({ initialSyncLimit: syncTime });
        this.client.startClient({ initialSyncLimit: 4, pollTimeout: 10 });
    }

    stopClient() {
        this.removeSyncCallbacks();
        this.client.stopClient();
        api.auth.removeAccessToken();
    }

    setTimelineChatsCallback = syncCallback => this.timelineChatsCallback = syncCallback;

    setTimelineChatCallback = syncCallback => this.timelineChatCallback = syncCallback;

    removeTimelineChatsCallback = () => this.setTimelineChatsCallback(null);
    removeTimelineChatCallback = () => this.setTimelineChatCallback(null);

    removeSyncCallbacks = () => {
        this.removeTimelineChatsCallback();
        this.removeTimelineChatCallback(null);

    }

    getRoomsForChatsList() {
        if (this.client) {
            const arr = this.client.getVisibleRooms();
            const rooms = {};
            const userIdsDM = {};
            let totalUnread = 0;
            arr.forEach((matrixRoom) => {
                const room = new Room({ matrixRoom, myUserId: this.userId });
                rooms[matrixRoom.roomId] = room;
                if (room.isDirect) {
                    userIdsDM[room.userIdDM] = room.id;
                }
                totalUnread += room.unread;
            });
            this.setUnread(null, null, totalUnread);
            return { rooms, userIdsDM };
        }
        return {rooms: {}, userIdsDM: {}};
    }

    getRoom({roomId, matrixRoom, possibleEventsTypes, possibleContentTypes}) {
        if (!matrixRoom && roomId) {
            matrixRoom = this.client.getRoom(roomId);
        }
        if (matrixRoom) {
            const room = new Room({ matrixRoom, possibleEventsTypes, possibleContentTypes, myUserId: this.userId });
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
        if (displayName) {
            const res = await api.profile.updateDisplayName(this.userId, displayName);
            return res;
        }
        return {status: false};
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

    async exitFromRoom(roomId) {
        return this.client.leave(roomId).then(() => {
            return this.client.forget(roomId).then(() => true).catch(() => false);
        }).catch(() => false);
    }

    async setPusher(options) {
        if (!(options && options.pushkey && options.data && options.data.url && options.app_id)) {
            return {status: false};
        }
        const defaultOptions = {
            pushkey,
            lang: lang || 'en',
            kind: kind || 'http',
            app_display_name: 'MatrixClient',
            device_display_name: 'ClientDeviceName',
            append: false,
        }
        const res = await api.pusher.setPusher({...defaultOptions, ...options});
        return res;
    }
}

export default Matrix.getInstance();
