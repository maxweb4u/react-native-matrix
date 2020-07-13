/**
 * Created by Max Gor on 6/20/20
 *
 * This is model for matrix event
 */

import getUid from 'get-uid';
import Utils from '../lib/utils';
import Content from './Content';
import ContentText from './ContentText';
import ContentImage from './ContentImage';
import ContentFile from './ContentFile';
import EventTypes from '../consts/EventTypes';
import MsgTypes from '../consts/MsgTypes';

class Event {
    matrixEvent = null;

    contentObj = null;

    id = null;

    uid = null;

    type = EventTypes.mRoomMessage;

    createdDate = 0;

    constructor(matrixEvent, eventObj) {
        if (matrixEvent) {
            this.matrixEvent = matrixEvent;
            this.type = matrixEvent.getType();
            this.uid = matrixEvent.getSender();
            this.id = matrixEvent.getId();
            const contentObj = matrixEvent.getContent();
            this.setContent(contentObj);
        } else if (eventObj) {
            this.type = eventObj.type || EventTypes.mRoomMessage;
            this.uid = eventObj.userId;
            this.id = getUid();
            this.createdDate = Utils.timestamp(true);
            this.setContent(eventObj.contentObj);
        }
    }

    get userId() {
        return this.uid;
    }

    get message() {
        if (!this.contentObj) {
            return '';
        }
        return this.contentObj.message;
    }

    get messageOnly() {
        if (!this.contentObj) {
            return '';
        }
        return this.contentObj.messageOnly;
    }

    get ts() {
        if (!this.matrixEvent) {
            return this.createdDate;
        }
        return this.matrixEvent.getTs();
    }

    get content() {
        if (!this.contentObj) {
            return new Content();
        }
        return this.contentObj;
    }

    get senderAvatarObj() {
        const noPhoto = require('../assets/nophoto.png');
        if (!this.matrixEvent || !this.matrixEvent.sender || !this.matrixEvent.sender.events || !this.matrixEvent.sender.events.member || !this.matrixEvent.sender.events.member.event || !this.matrixEvent.sender.events.member.event.content || !this.matrixEvent.sender.events.member.event.content.avatar_url) {
            return {noPhoto};
        }

        const { serverName, mediaId } = Utils.parseMXCURI(this.matrixEvent.sender.events.member.event.content.avatar_url);
        if (!serverName || !mediaId) {
            return {noPhoto};
        }

        return {serverName, mediaId, noPhoto};
    }

    get senderDisplayName() {
        if (!this.matrixEvent || !this.matrixEvent.sender) {
            return '';
        }
        return this.matrixEvent.sender.rawDisplayName || this.matrixEvent.sender.name;
    }

    get matrixContentObj() {
        if (!this.contentObj) {
            return {};
        }
        return this.contentObj.matrixContentObj;
    }

    setContent(contentObj) {
        switch (this.type) {
            case EventTypes.mRoomMessage:
                switch (contentObj.msgtype) {
                    case MsgTypes.mText:
                        this.contentObj = new ContentText(contentObj);
                        break;
                    case MsgTypes.mImage:
                        this.contentObj = new ContentImage(contentObj);
                        break;
                    default:
                        this.contentObj = new Content(contentObj);
                        break;
                }
                break;
            default:
                this.contentObj = new Content();
                break;
        }
    }

    setMatrixEvent(matrixEvent) {
        this.matrixEvent = matrixEvent;
        this.id = matrixEvent.getId();
    }

    static getEventObjText(userId, body, isQuote) {
        const obj = { userId, contentObj: ContentText.makeMessageObj(body, isQuote) };
        return obj;
    }

    static getEventObjFile(userId, msgtype, filename, uri, mimetype, base64, size){
        const contentObj = ContentFile.makeMessageObj(msgtype, filename, uri, mimetype, base64, size);
        const obj = { userId, contentObj };
        return obj;
    }
}

export default Event;
