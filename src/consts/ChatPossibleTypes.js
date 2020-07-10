/**
 * Created by Max Gor on 6/20/20
 *
 * This is types for event
 */

import EventTypes from './EventTypes';
import MsgTypes from './MsgTypes';

const PossibleChatEventsTypes = [EventTypes.mRoomMessage];
const PossibleChatContentTypes = [MsgTypes.mText, MsgTypes.mAudio, MsgTypes.mFile, MsgTypes.mImage];

export { PossibleChatEventsTypes, PossibleChatContentTypes };
