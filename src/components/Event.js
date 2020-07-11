/**
 * Created by Max Gor on 6/20/20
 *
 * This is container for rendering an event in a chat
 */

import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { View, StyleSheet, TouchableOpacity, Text, Image } from 'react-native';
import EventModel from '../models/Event';
import Utils from '../lib/utils';
import Colors from '../lib/colors';
import MsgTypes from '../consts/MsgTypes';
// import Matrix from '../Matrix';
import ContentText from './ContentText';

const styles = StyleSheet.create({
    container: { width: '100%' },
    containerMyEvent: { marginTop: 20, paddingRight: 10, paddingBottom: 0, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-end' },
    containerNotMyEvent: { marginTop: 28, paddingLeft: 10, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-start' },
    chatDay: { width: '100%', padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    chatDayLine: { width: '33%', height: 1, backgroundColor: Colors.grey },
    chatDayText: { color: Colors.blue },
    avatarPhoto: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
    containerMyMessage: {},
    containerNotMyMessage: { position: 'relative' },
    containerMyMessageContent: { padding: 10, paddingBottom: 2, backgroundColor: Colors.blue, borderRadius: 20, borderTopRightRadius: 0 },
    containerNotMyMessageContent: { padding: 10, paddingBottom: 2, borderRadius: 20, borderTopLeftRadius: 0, borderWidth: 0.5, borderColor: Colors.grey, minWidth: '70%' },
    containerMyMessageContentInner: {paddingBottom: 10},
    containerNotMyMessageContentInner: {paddingBottom: 10},
    containerSenderDisplayName: { position: 'absolute', top: -12 },
    senderDisplayNameText: { color: Colors.blueDark, fontSize: 10 },
    containerMyContentBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
    messageMyTimeText: { color: Colors.white, fontSize: 10 },
    containerNotMyContentBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    messageNotMyTimeText: { color: Colors.grey, fontSize: 10 },
    containerLike: {},
    containerMessageActions: { alignItems: 'center', justifyContent: 'center', width: 36, height: 36 },
    iconActions: { width: 20, height: 20 },
});

class Event extends PureComponent {
    getPropsStyle = (style) => {
        if (!Object.prototype.hasOwnProperty.call(this.props.eventStyles, style)) {
            return this.props.eventStyles[style];
        }
        return null;
    }

    showActions = () => {

    }

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
            return this.props.renderMessageAvatar(this.props.event.senderAvatarURI, this.props.isPrevUserTheSame);
        }
        if (!this.props.isPrevUserTheSame) {
            return <Image source={this.props.event.senderAvatarURI} style={[styles.avatarPhoto, this.getPropsStyle('avatarPhoto')]} />;
        }
        return <View style={[styles.avatarPhoto, this.getPropsStyle('avatarPhoto')]} />;
    }

    renderMyMessageContent = () => {
        if (this.props.renderMyMessageContent) {
            return this.props.renderMyMessageContent(this.props.event, this.renderMessageContent.bind(this), this.renderMyContentBottom.bind(this), this.props.isPrevUserTheSame);
        }
        return (
            <View style={[styles.containerMyMessage, this.getPropsStyle('containerMyMessage')]}>
                <View style={[styles.containerMyMessageContent, this.getPropsStyle('containerMyMessageContent')]}>
                    <View style={[styles.containerMyMessageContentInner, this.getPropsStyle('containerMyMessageContentInner')]}>{this.renderMessageContent({ isOwn: true })}</View>
                    {this.renderMyContentBottom()}
                </View>
            </View>
        );
    }

    renderNotMyMessageContent = () => {
        if (this.props.renderNotMyMessageContent) {
            return this.props.renderNotMyMessageContent(this.props.event, this.renderSenderName.bind(this), this.renderMessageContent.bind(this), this.renderNotMyContentBottom.bind(this), this.props.isPrevUserTheSame);
        }
        return (
            <View style={[styles.containerNotMyMessage, this.getPropsStyle('containerNotMyMessage')]}>
                {this.renderSenderName()}
                <View style={[styles.containerNotMyMessageContent, this.getPropsStyle('containerNotMyMessageContent')]}>
                    <View style={[styles.containerNotMyMessageContentInner, this.getPropsStyle('containerNotMyMessageContentInner')]}>{this.renderMessageContent({ isOwn: false })}</View>
                    {this.renderNotMyContentBottom()}
                </View>
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
                <View style={[styles.containerLike, this.getPropsStyle('containerLike')]} />
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
                return <ContentText isOwn={isOwn} contentObj={content} {...this.props.contentTextStyles} />;
        }
    }

    renderMessageActions = () => {
        if (this.props.renderMessageActions) {
            return this.props.renderMessageActions(this.props.event, this.showActions.bind(this));
        }
        return (
            <TouchableOpacity style={[styles.containerMessageActions, this.getPropsStyle('containerMessageActions')]} onPress={() => this.showActions()}>
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
    event: new EventModel(),
    eventStyles: {},
    contentTextStyles: {},
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
};
Event.propTypes = {
    event: PropTypes.object,
    eventStyles: PropTypes.object,
    contentTextStyles: PropTypes.object,
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
};

export default Event;
