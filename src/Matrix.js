/**
 * Created by Max Gor on 6/20/20
 *
 * This is a library for Matrix logic
 */
import './lib/poly.js';
import * as sdk from 'matrix-js-sdk';
import api from './api';
import Room from './models/Room';
import Event from './models/Event';
import EventTypes from './consts/EventTypes';
import MsgTypes from './consts/MsgTypes';

class Matrix {
    static instance;

    client = null;

    timelineChatsCallback = null;

    timelineChatCallback = null;

    totalUnreadPrev = null;

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

    get totalUnread() {
        let totalUnread = 0;
        if (this.client) {
            const matrixRooms = this.client.getVisibleRooms();
            matrixRooms.forEach((matrixRoom) => {
                const roomUnreadCount = matrixRoom.getUnreadNotificationCount() || 0;
                totalUnread += roomUnreadCount;
            });
        }
        this.totalUnreadPrev = totalUnread;
        return totalUnread;
    }

    get totalRooms() {
        if (this.client) {
            const matrixRooms = this.client.getVisibleRooms();
            return matrixRooms.length;
        }
        return 0;
    }

    initClient({ baseUrl, accessToken, userId, displayName }) {
        this.client = sdk.createClient({ baseUrl, accessToken, userId });
        api.auth.setBaseURL(baseUrl);
        api.auth.setAccessToken(accessToken);
        this.updateDisplayName(displayName);
    }

    async startClient(syncTime) {
        this.client.on('Room.timeline', (event, room, toStartOfTimeline) => {
            if (this.timelineChatsCallback) {
                this.timelineChatsCallback(event, room, toStartOfTimeline);
            }
            if (this.timelineChatCallback) {
                this.timelineChatCallback(event, room, toStartOfTimeline);
            }
        });
        // this.client.on('sync', (state, prevState, data) => {
        //     if (state === 'SYNCING' && data.nextSyncToken !== data.oldSyncToken) {
        //         // console.log(data.nextSyncToken, data.oldSyncToken)
        //     }
        // });
        // this.client.startClient({ initialSyncLimit: syncTime });
        await this.client.startClient({ initialSyncLimit: syncTime || 4, pollTimeout: 10 });
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

    // get unread count of all messages from all rooms and also save each room's unread to store of matrix-js-sdk
    setUnreadCount() {
        if (this.client) {
            const matrixRooms = this.client.getVisibleRooms();
            matrixRooms.map((matrixRoom) => {
                const roomUnreadCount = matrixRoom.getUnreadNotificationCount();
                if (typeof roomUnreadCount !== 'number') {
                    const lastReadEventId = matrixRoom.getEventReadUpTo(this.userId);
                    let numberUnread = 0;
                    const timeline = matrixRoom.getLiveTimeline();
                    const matrixEvents = timeline.getEvents();
                    let foundLastRead = false;
                    matrixEvents.map((matrixEvent) => {
                        if (Room.isEventPermitted(matrixEvent)) {
                            if (!foundLastRead && matrixEvent.getId() === lastReadEventId) {
                                foundLastRead = true;
                                numberUnread = 0;
                            } else {
                                numberUnread += 1;
                            }
                        }
                    });
                    matrixRoom.setUnreadNotificationCount('total', numberUnread);
                }
            });
        }
    }

    getRoomsForChatsList() {
        if (this.client) {
            const arr = this.client.getVisibleRooms();
            const rooms = {};
            const userIdsDM = {};
            arr.forEach((matrixRoom) => {
                const room = new Room({ matrixRoom, myUserId: this.userId, client: this.client });
                rooms[matrixRoom.roomId] = room;
                if (room.isDirect) {
                    userIdsDM[room.dmUserId] = room.id;
                }
            });
            return { rooms, userIdsDM };
        }
        return { rooms: {}, userIdsDM: {} };
    }

    getRoom({ roomId, matrixRoom, possibleEventsTypes, possibleContentTypes }) {
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
        return { status: false };
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

    async changeRoomTitle(roomId, title) {
        const res = await api.room.sendStateEvent(roomId, EventTypes.mRoomName, { name: title });
        return res.status;
    }

    async exitFromRoom(roomId) {
        return this.client.leave(roomId).then(() => this.client.forget(roomId).then(() => true).catch(() => false)).catch(() => false);
    }

    async setPusher(options) {
        if (!(options && options.pushkey && options.data && options.data.url && options.app_id)) {
            return { status: false };
        }
        const defaultOptions = {
            lang: 'en',
            kind: 'http',
            app_display_name: 'MatrixClient',
            device_display_name: 'ClientDeviceName',
            append: false,
        };
        const res = await api.pusher.setPusher({ ...defaultOptions, ...options });
        return res;
    }

    async setRoomReadMarkers(roomId, eventId) {
        const res = await api.room.setRoomReadMarkers(roomId, eventId);
        return res;
    }

    async saveImageForRoom(roomId, imageObj) {
        const eventObj = Event.getEventObjFile(this.userId, MsgTypes.mImage, imageObj.filename, imageObj.uri, imageObj.type, imageObj.base64);
        const event = new Event(null, eventObj);
        let res = await event.contentObj.uploadFile();
        if (res.status) {
            res = await api.room.sendStateEvent(roomId, EventTypes.mRoomAvatar, { url: event.matrixContentObj.url });
            return res.status;
        }
        return null;
    }

    inviteNewMembers(roomId, matrixUserIds) {
        if (this.client && matrixUserIds && matrixUserIds.length) {
            matrixUserIds.map(matrixUserId => this.client.invite(roomId, matrixUserId));
            return true;
        }
        return false;
    }
}

export default Matrix.getInstance();
