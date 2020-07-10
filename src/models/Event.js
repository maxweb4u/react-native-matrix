/**
 * Created by Max Gor on 6/20/20
 *
 * This is model for matrix event
 */

import getUid from 'get-uid';
import Content from './Content';
import ContentText from './ContentText';
import EventTypes from '../consts/EventTypes';
import MsgTypes from '../consts/MsgTypes';

class Event {
    matrixEvent = null;

    contentObj = null;

    constructor(matrixEvent) {
        if (matrixEvent) {
            this.matrixEvent = matrixEvent;
            switch (this.matrixEvent.getType()) {
                case EventTypes.mRoomMessage:
                    const content = this.matrixEvent.getContent();
                    switch (content.msgtype) {
                        case MsgTypes.mText: this.contentObj = new ContentText(content); break;
                        default: this.contentObj = new Content(content); break;
                    }
                    break;
                default:
                    this.contentObj = new Content();
                    break;
            }
        }
    }

    get id() {
        return this.matrixEvent.getId() || getUid();
    }

    get userId() {
        return this.matrixEvent.getSender() || '';
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
            return Number.MIN_SAFE_INTEGER;
        }
        return this.matrixEvent.getTs();
    }

    get content() {
        if (!this.contentObj) {
            return new Content();
        }
        return this.contentObj;
    }

    get senderAvatarURI() {
        const noPhoto = require('../assets/nophoto.png');
        return noPhoto;
    }

    get senderDisplayName() {
        return 'SenderDisplayName';
    }
}

export default Event;
