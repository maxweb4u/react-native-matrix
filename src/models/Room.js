/**
 * Created by Max Gor on 6/20/20
 *
 * This is model for chat
 */

import Event from './Event';
import utils from '../lib/utils';

class Room {
    id = 0;

    title = '';

    matrixRoom = null;

    isDirect = false;

    constructor(id, title, matrixRoom, isDirect) {
        this.id = id || 0;
        this.matrixRoom = matrixRoom || null;
        const alias = this.matrixRoom.getCanonicalAlias();
        this.title = alias || title;
        this.isDirect = isDirect || false;
    }

    get avatar() {
        const noPhoto = require('../assets/nophoto.png');
        return noPhoto;
    }

    get lastEventTimestamp() {
        return this.matrixRoom ? this.matrixRoom.getLastActiveTimestamp() : 0;
    }

    get lastEvent() {
        if (this.matrixRoom) {
            const timeline = this.matrixRoom.getLiveTimeline();
            const events = timeline.getEvents();
            if (events.length) {
                const lastEvent = events[events.length - 1];
                return new Event(lastEvent);
            }
        }
        return new Event();
    }

    get roomListInfoObj() {
        if (!this.id) {
            return null;
        }
        const roomId = this.id;
        const { avatar } = this;
        const { title } = this;
        const { lastEvent } = this;
        const lastMessage = utils.addDotsToString(lastEvent.message);
        const { ts } = this.lastEvent;
        const unread = this.matrixRoom.getUnreadNotificationCount();
        return { roomId, avatar, title, lastMessage, ts, unread };
    }
}


export default Room;
