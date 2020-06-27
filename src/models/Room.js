/**
 * Created by Max Gor on 6/20/20
 *
 * This is model for chat
 */

import Event from './Event';
import EventTypes from '../consts/EventTypes';
import MsgTypes from '../consts/MsgTypes';

class Room {
    id = 0;

    title = '';

    matrixRoom = null;

    messagesForSearch = [];

    lastEvent = null;

    isDirect = false;

    constructor(matrixRoom, isDirect) {
        if (matrixRoom) {
            this.id = matrixRoom.roomId || 0;
            this.matrixRoom = matrixRoom || null;
            const alias = this.matrixRoom.getCanonicalAlias();
            this.title = alias || matrixRoom.name;
            this.isDirect = isDirect || false;
            const timeline = this.matrixRoom.getLiveTimeline();
            const events = timeline.getEvents();
            if (events.length) {
                const lastEvent = events[events.length - 1];
                this.lastEvent = new Event(lastEvent);
            } else {
                this.lastEvent = new Event();
            }
            const messagesForSearch = [];
            events.forEach((event) => {
                if (event.getType() === EventTypes.mRoomMessage) {
                    const content = event.getContent();
                    if (content.body && content.msgtype && content.msgtype === MsgTypes.mText) {
                        messagesForSearch.push(content.body.toLowerCase());
                    }
                }
            });
            this.messagesForSearch = messagesForSearch;
        }
    }

    get avatar() {
        const noPhoto = require('../assets/nophoto.png');
        return noPhoto;
    }

    get lastEventTimestamp() {
        return this.matrixRoom ? this.matrixRoom.getLastActiveTimestamp() : 0;
    }

    get roomListObj() {
        if (!this.id) {
            return null;
        }
        const { id, avatar, title, lastEvent } = this;
        const { messageOnly, ts } = lastEvent;
        let unread = this.matrixRoom.getUnreadNotificationCount();
        if (unread > 99) {
            unread = 99;
        }
        return { id, avatar, title, message: messageOnly, ts, unread };
    }

    isFound(searchText) {
        if (this.title.toLowerCase().indexOf(searchText.toLowerCase()) !== -1) {
            return true;
        }
        if (this.messagesForSearch.length && this.messagesForSearch.find(e => e.indexOf(searchText.toLowerCase()) !== -1)) {
            return true;
        }
        return false;
    }
}


export default Room;
