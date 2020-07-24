/**
 * Created by Max Gor on 6/20/20
 *
 * This is model for chat
 */

import Event from './Event';
import Member from './Member';
import EventTypes from '../consts/EventTypes';
import MsgTypes from '../consts/MsgTypes';
import { PossibleChatEventsTypes, PossibleChatContentTypes } from '../consts/ChatPossibleTypes';
import api from '../api';

class Room {
    id = 0;

    title = '';

    matrixRoom = null;

    events = [];

    messagesForSearch = [];

    reactedEventIds = [];

    isDirect = false;

    possibleEventsTypes = PossibleChatEventsTypes;

    possibleContentTypes = PossibleChatContentTypes;

    memberhsip = '';

    userIdDM = '';

    myUserId = '';

    constructor({ matrixRoom, possibleEventsTypes, possibleContentTypes, myUserId }) {
        if (matrixRoom) {
            this.id = matrixRoom.roomId || 0;
            this.matrixRoom = matrixRoom || null;
            const alias = this.matrixRoom.getCanonicalAlias();
            this.title = alias || matrixRoom.name;
            this.membership = this.matrixRoom.getMyMembership();
            if (possibleEventsTypes) {
                this.possibleEventsTypes = possibleEventsTypes;
            }
            if (possibleContentTypes) {
                this.possibleContentTypes = possibleContentTypes;
            }
            this.myUserId = myUserId;
            this.isDirect = false;
            this.setEvents();
            if (this.isDirect) {
                this.userIdDM = this.matrixRoom.guessDMUserId();
            }

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
        const { id, avatar, title, lastEvent, membership, acceptInvite, leave, isDirect, unread } = this;
        const { messageOnly, ts } = lastEvent;
        const isInvite = membership === 'invite';
        return { id, avatar, title, message: messageOnly, ts, unread, membership, acceptInvite, leave, isInvite, isDirect  };
    }

    get lastEvent() {
        if (this.events.length) {
            const lastEvent = this.events[this.events.length - 1];
            return lastEvent;
        }
        const lastEvent = new Event();
        return lastEvent;
    }

    get allMembers() {
        const joined = this.getMembersObj();
        const invited = this.getMembersObj('invite');
        return {...joined, ...invited};
    }

    get myUserId() {
        return this.matrixRoom ? this.matrixRoom.myUserId : '';
    }

    get unread() {
        return this.matrixRoom.getUnreadNotificationCount() || 0;
    }

    get lastReadEventId() {
        return this.matrixRoom.getEventReadUpTo(this.myUserId)
    }

    setUnread(number) {
        this.matrixRoom.setUnreadNotificationCount('total', number)
    }

    increaseUnread() {
        this.setUnread(this.unread + 1);
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
        let numberUnread = 0;
        let foundLastRead = false;
        const lastUnread = this.matrixRoom.getUnreadNotificationCount();
        const checkUnread = typeof lastUnread !== 'number';
        const { lastReadEventId } = this;
        if (!checkUnread) {
            numberUnread = lastUnread;
        }
        matrixEvents.forEach((matrixEvent) => {
            const eventId = this.addMatrixEvent(matrixEvent);
            if (eventId && checkUnread) {
                if (!foundLastRead && lastReadEventId &&  eventId === lastReadEventId) {
                    foundLastRead = true;
                    numberUnread = 0;
                } else {
                    numberUnread += 1;
                }
            }
        });
        this.setUnread(numberUnread);
    }

    addMatrixEvent(matrixEvent) {
        const shouldBeAdded = Room.isEventPermitted(matrixEvent);
        if (!this.isDirect && Room.getIsDirect(matrixEvent)) {
            this.isDirect = true;
        }
        if (shouldBeAdded) {
            const event = new Event(matrixEvent);
            console.log(event.messageOnly)
            this.events.push(event);
            const content = matrixEvent.getContent();
            if (content.msgtype === MsgTypes.mText) {
                this.messagesForSearch.push(content.body.toLowerCase());
            }
            return event.id;
        }
        if (matrixEvent.getType() === EventTypes.mRoomReaction) {
            const content = matrixEvent.getContent();
            const realedObj = content.hasOwnProperty('m.relates_to') ? content['m.relates_to'] : null;
            if (realedObj && realedObj.event_id && realedObj.rel_type === 'm.annotation' && this.reactedEventIds.indexOf(realedObj.event_id) === -1) {
                this.reactedEventIds.push(realedObj.event_id);
            }
        }
        return null;
    }

    getMembers(membership) {
        if (!membership) {
            membership = 'join';
        }
        return this.matrixRoom.getMembersWithMembership(membership);
    }

    getMembersObj(membership) {
        const obj = {};
        const members = this.getMembers(membership);
        members.map((member) => { obj[member.userId] = new Member(member.user, this.myUserId); });
        return obj;
    }

    async acceptInvite() {
        const res = await api.room.acceptInvite(this.id);
        if (res.status) {
            this.membership = 'join';
        }
        return res;
    }

    async leave() {
        const res = await api.room.leaveRoom(this.id);
        if (res.status) {
            this.membership = 'leave';
        }
        return res;
    }

    static getIsDirect(e) {
        return (e.event && e.event.content && e.event.content.is_direct) || (e.sender && e.sender.events && e.sender.events.member && e.sender.events.member.event && e.sender.events.member.event.unsigned && e.sender.events.member.event.unsigned.prev_content && e.sender.events.member.event.unsigned.prev_content.is_direct)
    }

    static isEventPermitted(matrixEvent, possibleEventsTypes, possibleContentTypes) {
        if (!possibleEventsTypes) {
            possibleEventsTypes = PossibleChatEventsTypes;
        }
        if (!possibleContentTypes) {
            possibleContentTypes = PossibleChatContentTypes;
        }
        if (possibleEventsTypes.indexOf(matrixEvent.getType()) !== -1) {
            const content = matrixEvent.getContent();
            return content.body && content.msgtype && possibleContentTypes.indexOf(content.msgtype) !== -1;
        }
        return false;
    }
}


export default Room;
