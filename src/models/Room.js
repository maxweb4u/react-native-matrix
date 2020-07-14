/**
 * Created by Max Gor on 6/20/20
 *
 * This is model for chat
 */

import Event from './Event';
import EventTypes from '../consts/EventTypes';
import MsgTypes from '../consts/MsgTypes';
import { PossibleChatEventsTypes, PossibleChatContentTypes } from '../consts/ChatPossibleTypes';

class Room {
    id = 0;

    title = '';

    matrixRoom = null;

    events = [];

    messagesForSearch = [];

    reactedEventIds = [];

    lastEvent = null;

    isDirect = false;

    possibleEventsTypes = PossibleChatEventsTypes;

    possibleContentTypes = PossibleChatContentTypes;

    constructor({ matrixRoom, isDirect, possibleEventsTypes, possibleContentTypes }) {
        if (matrixRoom) {
            this.id = matrixRoom.roomId || 0;
            this.matrixRoom = matrixRoom || null;
            const alias = this.matrixRoom.getCanonicalAlias();
            this.title = alias || matrixRoom.name;
            this.isDirect = isDirect || false;
            if (possibleEventsTypes) {
                this.possibleEventsTypes = possibleEventsTypes;
            }
            if (possibleContentTypes) {
                this.possibleContentTypes = possibleContentTypes;
            }
            this.setEvents();
            console.log(this.reactedEventIds);
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

    setEvents() {
        const timeline = this.matrixRoom.getLiveTimeline();
        const matrixEvents = timeline.getEvents();
        // console.log(matrixEvents)
        matrixEvents.forEach((matrixEvent) => {
            this.addMatrixEvent(matrixEvent);
        });
    }

    addMatrixEvent(matrixEvent) {
        const shouldBeAdded = this.matrixEventCouldBeAdded(matrixEvent);
        if (shouldBeAdded) {
            this.events.push(new Event(matrixEvent));
            const content = matrixEvent.getContent();
            if (content.msgtype === MsgTypes.mText) {
                this.messagesForSearch.push(content.body.toLowerCase());
            }
            return true;
        } else {
            if (matrixEvent.getType() === EventTypes.mRoomReaction) {
                const content = matrixEvent.getContent();
                const realedObj = content.hasOwnProperty('m.relates_to') ? content['m.relates_to'] : null;
                if (realedObj && realedObj.event_id && realedObj.rel_type === 'm.annotation' && this.reactedEventIds.indexOf(realedObj.event_id) === -1) {
                    this.reactedEventIds.push(realedObj.event_id)
                }
            }
        }
    }

    getMembers(membership) {
        if (!membership) {
            membership = 'invite';
        }
        return this.matrixRoom.getMembersWithMembership(membership);
    }

    matrixEventCouldBeAdded(matrixEvent) {
        if (this.possibleEventsTypes.indexOf(matrixEvent.getType()) !== -1) {
            const content = matrixEvent.getContent();
            return content.body && content.msgtype && this.possibleContentTypes.indexOf(content.msgtype) !== -1;
        }
        return false;
    }
}


export default Room;
