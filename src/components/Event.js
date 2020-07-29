/**
 * Created by Max Gor on 6/20/20
 *
 * This is container for rendering an event in a chat
 */

import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { View, StyleSheet, TouchableOpacity, Text, Image, Platform, Clipboard } from 'react-native';
import ActionSheet from 'react-native-action-sheet';
import Share from 'react-native-share';
import Matrix from '../Matrix';
import EventModel from '../models/Event';
import Utils from '../lib/utils';
import Colors from '../lib/colors';
import MsgTypes from '../consts/MsgTypes';
import ContentText from './ContentText';
import ContentImage from './ContentImage';
import ContentAudio from './ContentAudio';
import ContentFile from './ContentFile';
import EventAvatar from './EventAvatar';
import trans from '../trans';

const styles = StyleSheet.create({
    container: { width: '100%' },
    containerMyEvent: { marginBottom: 5, marginTop: 15, paddingLeft: 100, paddingBottom: 0, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-end' },
    containerNotMyEvent: { marginBottom: 5, marginTop: 23, paddingLeft: 10, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-start' },
    chatDay: { width: '100%', padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    chatDayLine: { width: '33%', height: 1, backgroundColor: Colors.grey },
    chatDayText: { color: Colors.blue },
    avatarPhoto: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
    containerMyMessage: {},
    containerNotMyMessage: { position: 'relative' },
    containerMyMessageContent: { paddingBottom: 2, backgroundColor: Colors.blue, borderRadius: 20, borderTopRightRadius: 0 },
    containerNotMyMessageContent: { paddingBottom: 2, borderRadius: 20, borderTopLeftRadius: 0, borderWidth: 0.5, borderColor: Colors.grey },
    containerMyMessageContentInner: { paddingBottom: 10, alignItems: 'flex-end' },
    containerNotMyMessageContentInner: { paddingBottom: 10 },
    containerSenderDisplayName: { position: 'absolute', top: -12 },
    senderDisplayNameText: { color: Colors.blueDark, fontSize: 10 },
    containerMyContentBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 3, paddingLeft: 10, paddingRight: 10 },
    messageMyTimeText: { color: Colors.white, fontSize: 10 },
    containerNotMyContentBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 3, paddingLeft: 10, paddingRight: 10 },
    messageNotMyTimeText: { color: Colors.grey, fontSize: 10 },
    containerLike: {},
    likeButton: { height: 36, width: 36, alignItems: 'center', justifyContent: 'center' },
    likeImage: { width: 16, height: 16 },
    containerMessageActions: { alignItems: 'center', justifyContent: 'center', width: 36, height: 36 },
    iconActions: { width: 20, height: 20 },
});

class Event extends PureComponent {
    constructor(props) {
        super(props);
        this.state = { liked: false };
    }

    getPropsStyle = (style) => {
        if (Object.prototype.hasOwnProperty.call(this.props.eventStyles, style)) {
            return this.props.eventStyles[style];
        }
        return null;
    }

    showActions = () => {
        if (this.props.showEventActions) {
            this.props.showEventActions(this.copyToClipboard, this.share, this.quote);
            return null;
        }
        const iosButtons = [this.props.trans.t('event', 'copy'), this.props.trans.t('event', 'share'), this.props.trans.t('event', 'quote'), this.props.trans.t('event', 'cancel')];
        const androidButtons = [this.props.trans.t('event', 'copy'), this.props.trans.t('event', 'share'), this.props.trans.t('event', 'citate')];
        const cnf = {
            options: Platform.OS === 'android' ? androidButtons : iosButtons,
            cancelButtonIndex: 3,
            tintColor: Colors.blue,
        };
        ActionSheet.showActionSheetWithOptions(cnf, index => this.doAction(index));
        return null;
    }

    doAction = (index) => {
        switch (index) {
            case 0:
                this.copyToClipboard();
                break;
            case 1:
                this.share();
                break;
            case 2:
                this.quote();
                break;
            default:
                break;
        }
    }

    share = () => {
        const { event } = this.props;
        const shareOptions = {
            title: this.props.trans.t('event', 'shareTitle'),
            message: event.messageOnly,
        };
        if ((event.msgtype === MsgTypes.mImage || event.msgtype === MsgTypes.mFile) && event.content.base64ForShare) {
            shareOptions.url = event.content.base64ForShare;
        }
        Share.open(shareOptions);
        // if (callback) callback();
    }

    quote = (callback) => {
        if (callback) callback();
        this.props.addCitation(this.props.event.citationMessage, this.props.event.messageOnly, this.props.event.senderDisplayName);
    }

    copyToClipboard = async (callback) => {
        if (callback) callback();
        await Clipboard.setString(this.props.event.message);
    };

    likeEvent = () => {
        this.setState({ liked: true });
        Matrix.sendReaction(this.props.roomId, this.props.event.reactionContentObj);
    }

    isLiked = () => this.state.liked || this.props.reactedEventIds.indexOf(this.props.event.id) !== -1

    renderDay = () => {
        if (!this.props.isNewDay) {
            return null;
        }
        if (this.props.renderDay) {
            return this.props.renderDay(this.props.event.ts);
        }
        return (
            <View style={[styles.chatDay, this.getPropsStyle('chatDay')]}>
                <View style={[styles.chatDayLine, this.getPropsStyle('chatDayLine')]} />
                <Text style={[styles.chatDayText, this.getPropsStyle('chatDayText')]}>{Utils.formatTimestamp(this.props.event.ts, this.props.formatDayDate)}</Text>
                <View style={[styles.chatDayLine, this.getPropsStyle('chatDayLine')]} />
            </View>
        );
    }

    renderMessage = () => {
        if (this.props.isOwn) {
            return this.renderMyMessage();
        }
        return this.renderNotMyMessage();
    }

    renderMyMessage = () => {
        if (this.props.renderMyMessage) {
            return this.props.renderMyMessage(this.props.event, this.props.isPrevUserTheSame);
        }
        return (
            <View style={[styles.containerMyEvent, this.getPropsStyle('containerMyEvent')]}>
                {this.renderMyMessageContent()}
                {this.renderMessageActions()}
            </View>
        );
    }

    renderNotMyMessage = () => {
        if (this.props.renderNotMyMessage) {
            return this.props.renderNotMyMessage(this.props.event, this.props.isPrevUserTheSame);
        }
        return (
            <View style={[styles.containerNotMyEvent, this.getPropsStyle('containerNotMyEvent')]}>
                {this.props.showNotMyAvatar ? this.renderMessageAvatar() : null}
                {this.renderNotMyMessageContent()}
                {this.renderMessageActions()}
            </View>
        );
    }

    renderMessageAvatar = () => {
        if (this.props.renderMessageAvatar) {
            return this.props.renderMessageAvatar(this.props.event.senderAvatarObj, this.props.isPrevUserTheSame);
        }
        if (!this.props.isPrevUserTheSame) {
            return <EventAvatar avatarObj={this.props.event.senderAvatarObj} style={[styles.avatarPhoto, this.getPropsStyle('avatarPhoto')]} noPhotoSource={this.props.noEventPhotoSource} />;
        }
        return <View style={[styles.avatarPhoto, this.getPropsStyle('avatarPhoto')]} />;
    }

    renderMyMessageContent = () => {
        if (this.props.renderMyMessageContent) {
            return this.props.renderMyMessageContent(this.renderMessageContent.bind(this), this.renderMyContentBottom.bind(this));
        }
        const contentInner = (
            <View>
                <View style={[styles.containerMyMessageContentInner, this.getPropsStyle('containerMyMessageContentInner')]}>{this.renderMessageContent({ isOwn: true })}</View>
                {this.renderMyContentBottom()}
            </View>
        );
        return (
            <View style={[styles.containerMyMessage, this.getPropsStyle('containerMyMessage')]}>
                {this.props.renderContentInner ? this.props.renderContentInner(contentInner, true) : (<View style={[styles.containerMyMessageContent, this.getPropsStyle('containerMyMessageContent')]}>{contentInner}</View>)}
            </View>
        );
    }

    renderNotMyMessageContent = () => {
        if (this.props.renderNotMyMessageContent) {
            return this.props.renderNotMyMessageContent(this.renderSenderName.bind(this), this.renderMessageContent.bind(this), this.renderNotMyContentBottom.bind(this));
        }
        const contentInner = (
            <View>
                <View style={[styles.containerNotMyMessageContentInner, this.getPropsStyle('containerNotMyMessageContentInner')]}>{this.renderMessageContent({ isOwn: false })}</View>
                {this.renderNotMyContentBottom()}
            </View>
        );
        return (
            <View style={[styles.containerNotMyMessage, this.getPropsStyle('containerNotMyMessage')]}>
                {this.renderSenderName()}
                {this.props.renderContentInner ? this.props.renderContentInner(contentInner, false) : (<View style={[styles.containerNotMyMessageContent, this.getPropsStyle('containerNotMyMessageContent')]}>{contentInner}</View>)}
                {this.renderLike()}
            </View>
        );
    }

    renderLike = () => {
        if (this.props.renderLike) {
            this.props.renderLike(this.isLiked);
        }
        if (this.isLiked()) {
            return (
                <View style={[styles.containerLike, this.getPropsStyle('containerLike')]}>
                    <View style={[styles.likeButton, this.getPropsStyle('likeButton')]}>
                        <Image source={require('../assets/icon-liked.png')} style={[styles.likeImage, this.getPropsStyle('likeImage')]} />
                    </View>
                </View>
            );
        }
        return (
            <View style={[styles.containerLike, this.getPropsStyle('containerLike')]}>
                <TouchableOpacity style={[styles.likeButton, this.getPropsStyle('likeButton')]} onPress={this.likeEvent} {...Utils.testProps('btnEventLike')}>
                    <Image source={require('../assets/icon-not-liked.png')} style={[styles.likeImage, this.getPropsStyle('likeImage')]} />
                </TouchableOpacity>
            </View>
        );
    }

    renderSenderName = () => {
        if (this.props.renderSenderName) {
            return this.props.renderSenderName(this.props.event.senderDisplayName, this.props.isPrevUserTheSame);
        }
        return (
            <View style={[styles.containerSenderDisplayName, this.getPropsStyle('containerSenderDisplayName')]}>
                <Text style={[styles.senderDisplayNameText, this.getPropsStyle('senderDisplayNameText')]}>{this.props.event.senderDisplayName}</Text>
            </View>
        );
    }

    renderMyContentBottom = () => {
        if (this.props.renderMyContentBottom) {
            return this.props.renderMyContentBottom(this.props.event);
        }
        return (
            <View style={[styles.containerMyContentBottom, this.getPropsStyle('containerMyContentBottom')]}>
                <Text style={[styles.messageMyTimeText, this.getPropsStyle('messageMyTimeText')]}>{Utils.formatTimestamp(this.props.event.ts, this.props.formatMessageDate)}</Text>
            </View>
        );
    }

    renderNotMyContentBottom = () => {
        if (this.props.renderNotMyContentBottom) {
            return this.props.renderNotMyContentBottom(this.props.event);
        }
        return (
            <View style={[styles.containerNotMyContentBottom, this.getPropsStyle('containerNotMyContentBottom')]}>
                <Text style={[styles.messageNotMyTimeText, this.getPropsStyle('messageNotMyTimeText')]}>{Utils.formatTimestamp(this.props.event.ts, this.props.formatMessageDate)}</Text>
            </View>
        );
    }

    renderMessageContent = ({ isOwn }) => {
        if (this.props.renderMessageContent) {
            return this.props.renderMessageContent(this.props.event, isOwn);
        }

        const { content } = this.props.event;
        switch (content.type) {
            default:
            case MsgTypes.mText:
                return <ContentText isOwn={isOwn} contentObj={content} contentTextStyles={this.props.contentTextStyles} />;
            case MsgTypes.mImage:
                return <ContentImage isOwn={isOwn} contentObj={content} {...this.props.contentImageStyles} onImagePress={this.props.onImagePress} />;
            case MsgTypes.mAudio:
                return <ContentAudio isOwn={isOwn} contentObj={content} contentAudioStyles={this.props.contentAudioStyles} startAudioPlay={this.props.startAudioPlay} stopAudioPlay={this.props.stopAudioPlay} />;
            case MsgTypes.mFile:
                return <ContentFile isOwn={isOwn} contentObj={content} contentFileStyles={this.props.contentFileStyles} onFilePress={this.props.onFilePress} />;
        }
    }

    renderMessageActions = () => {
        if (this.props.renderMessageActions) {
            return this.props.renderMessageActions(this.props.event, this.showActions.bind(this));
        }
        return (
            <TouchableOpacity style={[styles.containerMessageActions, this.getPropsStyle('containerMessageActions')]} onPress={() => this.showActions()} {...Utils.testProps('btnEventActions')}>
                <Image source={this.props.iconMessageActions || require('../assets/icon-message-actions.png')} style={[styles.iconActions, this.getPropsStyle('iconActions')]} />
            </TouchableOpacity>
        );
    }

    render() {
        return (
            <View style={[styles.container, this.getPropsStyle('container')]}>
                {this.renderDay()}
                {this.renderMessage()}
            </View>
        );
    }
}
Event.defaultProps = {
    trans,
    event: new EventModel(),
    eventStyles: {},
    contentTextStyles: {},
    contentImageStyles: {},
    contentAudioStyles: {},
    contentFileStyles: {},
    isOwn: false,
    isNewDay: false,
    isPrevUserTheSame: false,
    showNotMyAvatar: true,
    formatDayDate: 'll',
    formatMessageDate: 'HH:mm',
    iconMessageActions: null,
    renderDay: null,
    renderMyMessage: null,
    renderNotMyMessage: null,
    renderMessageAvatar: null,
    renderMyMessageContent: null,
    renderNotMyMessageContent: null,
    renderSenderName: null,
    renderMyContentBottom: null,
    renderNotMyContentBottom: null,
    renderMessageContent: null,
    renderMessageActions: null,
    renderContentInner: null,
    renderLike: null,
    showEventActions: null,
    noEventPhotoSource: null,
    startAudioPlay: () => {},
    stopAudioPlay: () => {},
    onImagePress: null,
    onFilePress: null,
    roomId: '',
    reactedEventIds: [],
    addCitation: () => {},
};
Event.propTypes = {
    trans: PropTypes.object,
    event: PropTypes.object,
    eventStyles: PropTypes.object,
    contentTextStyles: PropTypes.object,
    contentImageStyles: PropTypes.object,
    contentAudioStyles: PropTypes.object,
    contentFileStyles: PropTypes.object,
    isOwn: PropTypes.bool,
    isNewDay: PropTypes.bool,
    isPrevUserTheSame: PropTypes.bool,
    showNotMyAvatar: PropTypes.bool,
    formatDayDate: PropTypes.string,
    formatMessageDate: PropTypes.string,
    iconMessageActions: PropTypes.object,
    renderDay: PropTypes.func,
    renderMyMessage: PropTypes.func,
    renderNotMyMessage: PropTypes.func,
    renderMessageAvatar: PropTypes.func,
    renderMyMessageContent: PropTypes.func,
    renderNotMyMessageContent: PropTypes.func,
    renderSenderName: PropTypes.func,
    renderMyContentBottom: PropTypes.func,
    renderNotMyContentBottom: PropTypes.func,
    renderMessageContent: PropTypes.func,
    renderMessageActions: PropTypes.func,
    renderContentInner: PropTypes.func,
    renderLike: PropTypes.func,
    showEventActions: PropTypes.func,
    noEventPhotoSource: PropTypes.object,
    startAudioPlay: PropTypes.func,
    stopAudioPlay: PropTypes.func,
    onImagePress: PropTypes.func,
    onFilePress: PropTypes.func,
    roomId: PropTypes.string,
    reactedEventIds: PropTypes.arrayOf(PropTypes.string),
    addCitation: PropTypes.func,
};

export default Event;
