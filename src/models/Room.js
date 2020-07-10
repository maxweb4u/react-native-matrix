/**
 * Created by Max Gor on 6/20/20
 *
 * This is model for chat
 */

import Event from './Event';
import MsgTypes from '../consts/MsgTypes';
import { PossibleChatEventsTypes, PossibleChatContentTypes } from '../consts/ChatPossibleTypes';

class Room {
    id = 0;

    title = '';

    matrixRoom = null;

    events = [];

    messagesForSearch = [];

    lastEvent = null;

    isDirect = false;

    constructor({ matrixRoom, isDirect, possibleEventsTypes, possibleContentTypes }) {
        if (matrixRoom) {
            this.id = matrixRoom.roomId || 0;
            this.matrixRoom = matrixRoom || null;
            const alias = this.matrixRoom.getCanonicalAlias();
            this.title = alias || matrixRoom.name;
            this.isDirect = isDirect || false;
            this.setEvents(possibleEventsTypes, possibleContentTypes);
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

    get lastEvent() {
        if (this.events.length) {
            const lastEvent = this.events[this.events.length - 1];
            return lastEvent;
        }
        const lastEvent = new Event();
        return lastEvent;
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

    setEvents(possibleEventsTypes, possibleContentTypes) {
        const timeline = this.matrixRoom.getLiveTimeline();
        const matrixEvents = timeline.getEvents();
        if (!possibleEventsTypes) {
            possibleEventsTypes = PossibleChatEventsTypes;
        }
        if (!possibleContentTypes) {
            possibleContentTypes = PossibleChatContentTypes;
        }
        const events = [];
        const messagesForSearch = [];
        matrixEvents.forEach((matrixEvent) => {
            if (possibleEventsTypes.indexOf(matrixEvent.getType()) !== -1) {
                const content = matrixEvent.getContent();
                if (content.body && content.msgtype) {
                    if (content.msgtype === MsgTypes.mText) {
                        messagesForSearch.push(content.body.toLowerCase());
                    }
                    if (possibleContentTypes.indexOf(content.msgtype) !== -1) {
                        const event = new Event(matrixEvent);
                        events.push(event);
                    }
                }
            }
        });
        this.messagesForSearch = messagesForSearch;
        this.events = events;
    }
}


export default Room;
