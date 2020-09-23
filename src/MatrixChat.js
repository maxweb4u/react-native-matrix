/**
 * Created by Max Gor on 6/20/20
 *
 * This is component that shows chat room
 */

import React, { Component } from 'react';
import { Animated, View, Platform, SafeAreaView } from 'react-native';
import { timer } from 'rxjs';
import getUid from 'get-uid';
import PropTypes from 'prop-types';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import trans from './trans';
import Matrix from './Matrix';
import Event from './models/Event';
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
        this.isPropsOnLoaded = false;
        this.members = [];

        if (this.props.roomId) {
            this.loadRoom({ roomId: this.props.roomId });
        }

        this.state = {
            isLoading: true,
            alwaysNewValue: '',
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
            if (this.room && this.room.lastEvent.id && (!this.room.lastReadEventId || this.room.lastReadEventId !== this.room.lastEvent.id)) {
                Matrix.setRoomReadMarkers(this.room.id, this.room.lastEvent.id);
            }
            this.subscription = timer(1000).subscribe(() => {
                Matrix.setTimelineChatCallback(this.syncCallback);
            });
        }
        if (!this.isPropsOnLoaded && this.room) {
            this.isPropsOnLoaded = true;
            this.props.onLoaded({ roomTitle: this.room.title, isDirect: this.room.isDirect });
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        const shouldBeRefreshed = nextProps.shouldBeRefreshed && nextProps.shouldBeRefreshed !== this.props.shouldBeRefreshed;
        if (shouldBeRefreshed) {
            this.loadRoom({ roomId: this.props.roomId });
        }
        return true;
        // return shouldBeRefreshed
        //     || (this.state.composerHeight !== nextState.composerHeight)
        //     || (this.state.removePrevAudioListener && this.state.removePrevAudioListener !== nextState.removePrevAudioListener)
        //     || (this.state.alwaysNewValue !== nextState.alwaysNewValue);
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

    // refresh component through change the state and if this component is shown in screen (isShown is func from props, by default it always returns true)
    refreshComponent = (isScrollToBottom) => {
        if (this.props.isShown()) {
            this.setState({ alwaysNewValue: getUid() }, () => {
                if (isScrollToBottom) {
                    this.scrollToBottom();
                }
            });
        }
    }

    // load room from matrix store or from matrixRoom
    loadRoom = ({ roomId, matrixRoom }) => {
        const room = Matrix.getRoom({ roomId, matrixRoom, possibleEventsTypes: this.props.possibleChatEvents, possibleContentTypes: this.props.possibleChatContentTypes });
        if (room) {
            this.room = room;
            this.members = this.room.getMembersObj();
        }
    }

    // synchronizate chat when new event is come
    syncCallback = (matrixEvent, matrixRoom) => {
        if (matrixRoom && matrixEvent && matrixRoom.getLastActiveTimestamp() <= matrixEvent.getTs() && matrixRoom.roomId === this.props.roomId && Matrix.userId !== matrixEvent.getSender()) {
            const isAdded = this.addEvent({ matrixEvent });
            if (isAdded) {
                Matrix.setRoomReadMarkers(matrixRoom.roomId, matrixEvent.getId());
            }
        }
    }

    // load early message to event's timeline, return promise pageToken or falsy value if there is no previous messages
    loadEarlyMessages = () => Matrix.loadEarlyMessages(this.room.matrixRoom, 20).then((matrixRoom) => {
        this.loadRoom({ matrixRoom });
        this.refreshComponent();
        return matrixRoom.oldState.paginationToken;
    }).catch(() => false)

    // executed when message is sent and we need to set that it's read and add it matrix's store
    messageSent = (eventId) => {
        if (!eventId) {
            return null;
        }
        Matrix.setRoomReadMarkers(this.room.id, eventId);
        this.room.addSentMessageById(eventId);
        return true;
    }

    // add my own messages to component's events
    addEvent = ({ event, matrixEvent }) => {
        if (this.room && (event || matrixEvent)) {
            const isAdded = this.room.addEvent({ event, matrixEvent });
            if (isAdded) {
                this.refreshComponent(true);
                return true;
            }
        }
        return false;
    }

    // send text messages
    sendText = async (text, isQuote) => {
        const event = new Event(null, Event.getEventObjText(Matrix.userId, text, isQuote));
        this.addEvent({ event });
        Matrix.sendMessage(this.props.roomId, event.matrixContentObj).then(res => this.messageSent(res.event_id)).catch(err => this.props.errorCallback(err));
    }

    // send file/image/audio messages
    sendFile = async (msgtype, filename, uri, mimetype, base64, size, duration) => {
        const eventObj = Event.getEventObjFile(Matrix.userId, msgtype, filename, uri, mimetype, base64, size, duration);
        const event = new Event(null, eventObj);
        this.addEvent({ event });
        const res = await event.contentObj.uploadFile();
        if (res.status) {
            Matrix.sendMessage(this.props.roomId, event.matrixContentObj).then(result => this.messageSent(result.event_id)).catch(err => this.props.errorCallback(err));
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
        const { messagesContainerHeight } = this.state;
        const AnimatedView = this.props.isAnimated ? Animated.View : View;
        return (
            <AnimatedView style={{ height: messagesContainerHeight }}>
                <EventsContainer
                    ref={this.messageContainerRef}
                    eventProps={this.props.eventProps}
                    addCitation={this.addCitation}
                    cancelCitation={this.cancelCitation}
                    events={this.room.chatEvents}
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
            members: this.members,
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
    shouldBeRefreshed: '',
    isShown: () => true,
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
    shouldBeRefreshed: PropTypes.string,
    isShown: PropTypes.func,
};

export default MatrixChat;
