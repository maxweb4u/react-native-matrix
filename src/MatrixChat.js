/**
 * Created by Max Gor on 6/20/20
 *
 * This is component that shows chat room
 */

import React, { Component } from 'react';
import { Animated, View, Platform, SafeAreaView } from 'react-native';
import { timer } from 'rxjs';
import PropTypes from 'prop-types';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import trans from './trans';
import Matrix from './Matrix';
import Event from './models/Event';
import Room from './models/Room';
import isIphoneX from './lib/isIphoneX';
import EventsContainer from './components/EventsContainer';
import InputToolbar from './components/InputToolbar';
import { PossibleChatEventsTypes, PossibleChatContentTypes } from './consts/ChatPossibleTypes';

class MatrixChat extends Component {
    room = null;

    audioRecorderPlayer = new AudioRecorderPlayer();

    constructor(props) {
        super(props);
        trans.setLocale(this.props.locale);
        trans.setTransFromProps(this.props.trans);

        this.keyboardHeight = 0;
        this.bottomOffset = this.getBottomOffsetIphoneX;
        this.maxHeight = undefined;
        this.messageContainerRef = React.createRef();
        this.inputToolbarRef = React.createRef();

        this.state = {
            isLoading: true,
            events: [],
            members: [],
            composerHeight: this.props.minComposerHeight,
            messagesContainerHeight: undefined,
            removePrevAudioListener: null,
        };

        const onKeyboardWillShow = (e) => {
            this.setKeyboardHeight(e.endCoordinates ? e.endCoordinates.height : e.end.height);
            this.setBottomOffset(this.getBottomKeyboardOffset);
            const newMessagesContainerHeight = this.getMessagesContainerHeightWithKeyboard();
            this.setContainerHeight(newMessagesContainerHeight);
        };
        const onKeyboardWillHide = () => {
            this.setKeyboardHeight(0);
            this.setBottomOffset(this.getBottomOffsetIphoneX);
            const newMessagesContainerHeight = this.getBasicMessagesContainerHeight();
            this.setContainerHeight(newMessagesContainerHeight);
        };
        // const onKeyboardDidShow = (e) => {
        //     if (Platform.OS === 'android') {
        //         this.onKeyboardWillShow(e);
        //     }
        // };
        // const onKeyboardDidHide = (e) => {
        //     if (Platform.OS === 'android') {
        //         this.onKeyboardWillHide(e);
        //     }
        // };

        this.keyboardListeners = { onKeyboardWillShow, onKeyboardWillHide };

        this.onInputSizeChanged = (size) => {
            const newComposerHeight = Math.max(this.props.minComposerHeight, Math.min(this.props.maxComposerHeight, size.height));
            const newMessagesContainerHeight = this.getMessagesContainerHeightWithKeyboard(newComposerHeight);
            this.setState({
                composerHeight: newComposerHeight,
                messagesContainerHeight: this.prepareMessagesContainerHeight(newMessagesContainerHeight),
            });
        };
        this.onInitialLayoutViewLayout = (e) => {
            const { layout } = e.nativeEvent;
            if (layout.height <= 0) {
                return;
            }
            this.setMaxHeight(layout.height);
            const newComposerHeight = this.props.minComposerHeight;
            const newMessagesContainerHeight = this.getMessagesContainerHeightWithKeyboard(newComposerHeight);
            this.setState({
                composerHeight: newComposerHeight,
                messagesContainerHeight: this.prepareMessagesContainerHeight(newMessagesContainerHeight),
                isLoading: false,
            });
        };
    }

    componentDidMount() {
        if (this.props.roomId) {
            this.loadRoom({ roomId: this.props.roomId });
            if (this.room && this.room.lastEvent.id) {
                Matrix.setRoomReadMarkers(this.room.id, this.room.lastEvent.id);
            }
            this.subscription = timer(1000).subscribe(() => {
                Matrix.setTimelineChatCallback(this.syncCallback);
            });
        }
    }

    componentWillUnmount() {
        Matrix.removeTimelineChatCallback();
        if (this.state.removePrevAudioListener) {
            this.audioRecorderPlayer.stopPlayer();
            this.state.removePrevAudioListener();
        }
    }

    get getBottomOffsetIphoneX() {
        if (isIphoneX()) {
            return !this.props.bottomOffset ? 30 : this.props.bottomOffset + 10;
        }
        return this.props.bottomOffset;
    }

    get getBottomKeyboardOffset() {
        return 10;
    }

    loadRoom = ({ roomId, matrixRoom }) => {
        const room = Matrix.getRoom({ roomId, matrixRoom, possibleEventsTypes: this.props.possibleChatEvents, possibleContentTypes: this.props.possibleChatContentTypes });
        if (room) {
            this.room = room;
            const reversedEvents = room.events.reverse();
            this.setState({ events: reversedEvents, members: room.getMembersObj() }, () => {
                this.props.onLoaded({ roomTitle: room.title, isDirect: room.isDirect });
            });
        }
    }

    loadEarlyMessages = () => Matrix.loadEarlyMessages(this.room.matrixRoom, 20).then((matrixRoom) => {
        this.loadRoom({ matrixRoom });
        return matrixRoom.oldState.paginationToken;
    }).catch(() => false)

    messageIsSent = (eventId) => {
        const matrixEvent = Matrix.getEvent(eventId);
        Matrix.setRoomReadMarkers(this.room.roomId, matrixEvent.getId());
        this.room.addMatrixEvent(matrixEvent);
    }

    addEvent = ({ event, matrixEvent }) => {
        if (event || matrixEvent) {
            let { events } = this.state;
            if (matrixEvent) {
                event = new Event(matrixEvent);
            }
            events = [event].concat(events);
            this.setState({ events }, () => {
                this.scrollToBottom();
            });
            return events.length - 1;
        }
        return 0;
    }

    sendText = async (text, isQuote) => {
        const event = new Event(null, Event.getEventObjText(Matrix.userId, text, isQuote));
        this.addEvent({ event });
        Matrix.sendMessage(this.props.roomId, event.matrixContentObj).then(res => this.messageIsSent(res.event_id)).error(err => this.props.errorCallback(err));
    }

    sendFile = async (msgtype, filename, uri, mimetype, base64, size, duration) => {
        const eventObj = Event.getEventObjFile(Matrix.userId, msgtype, filename, uri, mimetype, base64, size, duration);
        const event = new Event(null, eventObj);
        this.addEvent({ event });
        const res = await event.contentObj.uploadFile();
        if (res.status) {
            Matrix.sendMessage(this.props.roomId, event.matrixContentObj).then(result => this.messageIsSent(result.event_id)).error(err => this.props.errorCallback(err));
        }
    }

    syncCallback = (matrixEvent, room) => {
        if (room && matrixEvent && room.roomId === this.props.roomId && Matrix.userId !== matrixEvent.getSender()) {
            const shouldBeAdded = Room.isEventPermitted(matrixEvent);
            if (shouldBeAdded) {
                Matrix.setRoomReadMarkers(room.roomId, matrixEvent.getId());
                this.addEvent({ matrixEvent });
            }
        }
    }

    setContainerHeight = (newHeight) => {
        if (this.props.isAnimated) {
            Animated.timing(this.state.messagesContainerHeight, {
                toValue: newHeight,
                duration: 200,
            }).start(() => {
                this.scrollToBottom();
            });
        } else {
            this.setState({ messagesContainerHeight: newHeight });
        }
    }

    setMaxHeight = height => this.maxHeight = height;

    getMaxHeight = () => this.maxHeight;

    setKeyboardHeight = height => this.keyboardHeight = height;

    getKeyboardHeight = () => ((Platform.OS === 'android' && !this.props.forceGetKeyboardHeight) ? 0 : this.keyboardHeight);

    setBottomOffset = value => this.bottomOffset = value;

    getBottomOffset = () => this.bottomOffset;

    calculateInputToolbarHeight = composerHeight => (composerHeight || this.state.composerHeight) + this.getBottomOffset() + this.props.inputToolbarPaddingTop;

    getBasicMessagesContainerHeight = composerHeight => (this.getMaxHeight() - this.calculateInputToolbarHeight(composerHeight));

    getMessagesContainerHeightWithKeyboard = composerHeight => (this.getBasicMessagesContainerHeight(composerHeight) - this.getKeyboardHeight());

    prepareMessagesContainerHeight = value => (this.props.isAnimated ? new Animated.Value(value) : value);

    scrollToBottom = (animated) => {
        if (animated) {
            animated = true;
        }
        if (this.messageContainerRef && this.messageContainerRef.current) {
            this.messageContainerRef.current.scrollToBottom({ animated });
        }
    }

    startAudioPlay = async (url, playBack, removePrevAudioListener) => {
        try {
            if (this.state.removePrevAudioListener) {
                this.state.removePrevAudioListener();
            }
            this.audioRecorderPlayer.stopPlayer();
            this.audioRecorderPlayer.removePlayBackListener();
            this.setState({ removePrevAudioListener });
            await this.audioRecorderPlayer.startPlayer(url);
            this.audioRecorderPlayer.addPlayBackListener((e) => {
                if (e.current_position === e.duration) {
                    this.audioRecorderPlayer.stopPlayer();
                    this.state.removePrevAudioListener();
                }
                playBack(e);
            });
        } catch (e) {
            // console.log(`cannot play the sound file`, e)
        }
    };

    stopAudioPlay = async () => {
        this.audioRecorderPlayer.stopPlayer();
        this.audioRecorderPlayer.removePlayBackListener();
        this.setState({ removePrevAudioListener: null });
    };

    addCitation = (quoteMessageToSend, quoteMessage, quoteAuthor) => {
        if (this.inputToolbarRef && this.inputToolbarRef.current) {
            this.inputToolbarRef.current.addCitation(quoteMessageToSend, quoteMessage, quoteAuthor);
        }
    }

    cancelCitation = () => {
        if (this.inputToolbarRef && this.inputToolbarRef.current) {
            this.inputToolbarRef.current.cancelCitation();
        }
    }

    messageSent = () => {
        if (this.messageContainerRef && this.messageContainerRef.current) {
            this.messageContainerRef.current.messageSent();
        }
    }

    renderContainer = () => {
        if (this.props.renderContainer) {
            return this.props.renderContainer(this.renderEvents, this.renderInputToolbar);
        }

        return (
            <View style={this.props.style}>
                {this.renderEvents()}
                {this.renderInputToolbar()}
            </View>
        );
    }

    renderEvents = () => {
        const { events, messagesContainerHeight } = this.state;
        const AnimatedView = this.props.isAnimated ? Animated.View : View;
        return (
            <AnimatedView style={{ height: messagesContainerHeight }}>
                <EventsContainer
                    ref={this.messageContainerRef}
                    eventProps={this.props.eventProps}
                    addCitation={this.addCitation}
                    cancelCitation={this.cancelCitation}
                    events={events}
                    reactedEventIds={!!this.room && this.room.reactedEventIds}
                    startAudioPlay={this.startAudioPlay}
                    stopAudioPlay={this.stopAudioPlay}
                    roomId={this.props.roomId}
                    loadEarlyMessages={this.loadEarlyMessages}
                    eventsStyles={this.props.eventsStyles}
                    icons={this.props.icons}
                    trans={trans}
                />
            </AnimatedView>
        );
    }

    renderInputToolbar = () => {
        const { composerHeight } = this.state;
        const { minComposerHeight, inputToolbarProps } = this.props;
        const props = {
            onInputSizeChanged: this.onInputSizeChanged,
            composerHeight: Math.max(minComposerHeight, composerHeight),
            inputbarHeight: this.calculateInputToolbarHeight(),
            keyboardListeners: this.keyboardListeners,
            trans: { inputToolbar: trans.t('inputToolbar'), fileModule: trans.t('fileModule') },
            sendMessage: { text: this.sendText.bind(this), file: this.sendFile.bind(this) },
            members: this.state.members,
            messageSent: this.messageSent,
            icons: this.props.icons,
            ...inputToolbarProps,
        };
        if (this.props.renderInputToolbar) {
            return this.props.renderInputToolbar(props);
        }
        return <InputToolbar ref={this.inputToolbarRef} {...props} />;
    }

    render() {
        if (!this.state.isLoading) {
            if (this.props.renderWithSafeArea) {
                return <SafeAreaView style={this.props.style}>{this.renderContainer()}</SafeAreaView>;
            }
            return this.renderContainer();
        }
        return <View style={this.props.style} onLayout={this.onInitialLayoutViewLayout} />;
    }
}

MatrixChat.defaultProps = {
    style: { flex: 1 },
    trans: null,
    render: null,
    renderContainer: null,
    locale: 'en',
    roomId: '',
    possibleChatEvents: PossibleChatEventsTypes,
    possibleChatContentTypes: PossibleChatContentTypes,
    bottomOffset: 20,
    minComposerHeight: Platform.select({ ios: 33, android: 41 }),
    maxComposerHeight: 200,
    onInputTextChanged: () => {},
    onLoaded: () => {},
    isAnimated: Platform.select({ ios: true, android: false }),
    renderWithSafeArea: false,
    maxInputLength: null,
    forceGetKeyboardHeight: false,
    inputToolbarPaddingTop: 10,
    renderInputToolbar: null,
    errorCallback: () => {},
    eventProps: {},
    inputToolbarProps: {},
    eventsStyles: {},
    icons: {},
};

MatrixChat.propTypes = {
    style: PropTypes.object,
    trans: PropTypes.object,
    render: PropTypes.func,
    renderContainer: PropTypes.func,
    locale: PropTypes.string,
    roomId: PropTypes.string,
    possibleChatEvents: PropTypes.array,
    possibleChatContentTypes: PropTypes.array,
    bottomOffset: PropTypes.number,
    minComposerHeight: PropTypes.number,
    maxComposerHeight: PropTypes.number,
    onInputTextChanged: PropTypes.func,
    onLoaded: PropTypes.func,
    isAnimated: PropTypes.bool,
    renderWithSafeArea: PropTypes.bool,
    maxInputLength: PropTypes.number,
    forceGetKeyboardHeight: PropTypes.bool,
    inputToolbarPaddingTop: PropTypes.number,
    renderInputToolbar: PropTypes.func,
    errorCallback: PropTypes.func,
    eventProps: PropTypes.object,
    inputToolbarProps: PropTypes.object,
    eventsStyles: PropTypes.object,
    icons: PropTypes.object,
};

export default MatrixChat;
