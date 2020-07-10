/**
 * Created by Max Gor on 6/20/20
 *
 * This is component that shows chat room
 */

import React, { Component } from 'react';
import { Animated, View, Platform, SafeAreaView } from 'react-native';
import { timer } from 'rxjs';
import PropTypes from 'prop-types';
import trans from './trans';
import Matrix from './Matrix';
import isIphoneX from './lib/isIphoneX';
import EventsContainer from './components/EventsContainer';
import InputToolbar from './components/InputToolbar';
import { PossibleChatEventsTypes, PossibleChatContentTypes } from './consts/ChatPossibleTypes';

class MatrixChat extends Component {
    room = null;

    constructor(props) {
        super(props);
        trans.setLocale(this.props.locale);

        this.keyboardHeight = 0;
        this.bottomOffset = 0;
        this.maxHeight = undefined;
        this.messageContainerRef = React.createRef();

        this.state = {
            isLoading: true,
            events: [],
            members: [],
            composerHeight: this.props.minComposerHeight,
            messagesContainerHeight: undefined,
            text: '',
        };

        const onKeyboardWillShow = (e) => {
            this.setKeyboardHeight(e.endCoordinates ? e.endCoordinates.height : e.end.height);
            this.setBottomOffset(this.getBottomOffsetIphoneX);
            const newMessagesContainerHeight = this.getMessagesContainerHeightWithKeyboard();
            this.setContainerHeight(newMessagesContainerHeight);
        };
        const onKeyboardWillHide = () => {
            this.setKeyboardHeight(0);
            this.setBottomOffset(0);
            const newMessagesContainerHeight = this.getBasicMessagesContainerHeight();
            this.setContainerHeight(newMessagesContainerHeight);
        };
        const onKeyboardDidShow = (e) => {
            if (Platform.OS === 'android') {
                this.onKeyboardWillShow(e);
            }
        };
        const onKeyboardDidHide = (e) => {
            if (Platform.OS === 'android') {
                this.onKeyboardWillHide(e);
            }
        };

        this.keyboardListeners = { onKeyboardWillShow, onKeyboardWillHide, onKeyboardDidShow, onKeyboardDidHide };

        this.onInputSizeChanged = (size) => {
            const newComposerHeight = Math.max(this.props.minComposerHeight, Math.min(this.props.maxComposerHeight, size.height));
            const newMessagesContainerHeight = this.getMessagesContainerHeightWithKeyboard(newComposerHeight);
            this.setState({
                composerHeight: newComposerHeight,
                messagesContainerHeight: this.prepareMessagesContainerHeight(newMessagesContainerHeight),
            });
        };
        this.onInputTextChanged = (text) => {
            if (this.props.onInputTextChanged) {
                this.props.onInputTextChanged(text);
            }
            this.setState({ text });
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
            });
        };
        this.onSend = () => {

        };
    }

    componentDidMount() {
        if (this.props.roomId) {
            const room = Matrix.getRoom(this.props.roomId, this.props.possibleChatEvents, this.props.possibleChatContentTypes);
            if (room) {
                this.room = room;
                this.setState({ events: room.events, members: room.getMembersWithMembership('invite'), isLoading: false }, () => {
                    this.props.onLoaded({ roomTitle: room.title });
                });
            }

            this.subscription = timer(1000).subscribe(() => {
                Matrix.setSyncCallback(this.syncCallback);
            });
        }
    }

    get getBottomOffsetIphoneX() {
        if (isIphoneX()) {
            return this.props.bottomOffset === this.bottomOffset ? 33 : this.props.bottomOffset;
        }
        return this.props.bottomOffset;
    }

    syncCallback = (event, room) => {

    }

    setContainerHeight = (newHeight) => {
        if (this.props.isAnimated) {
            Animated.timing(this.state.messagesContainerHeight, {
                toValue: newHeight,
                duration: 200,
            }).start();
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

    getMinInputToolbarHeight = () => this.props.minInputToolbarHeight;

    calculateInputToolbarHeight = composerHeight => (composerHeight + (this.getMinInputToolbarHeight() - this.props.minComposerHeight));

    /**
     * Returns the height, based on current window size, without taking the keyboard into account.
     */
    getBasicMessagesContainerHeight = composerHeight => (this.getMaxHeight() - this.calculateInputToolbarHeight(composerHeight || this.state.composerHeight));

    /**
     * Returns the height, based on current window size, taking the keyboard into account.
     */
    getMessagesContainerHeightWithKeyboard = composerHeight => (this.getBasicMessagesContainerHeight(composerHeight || this.state.composerHeight) - this.getKeyboardHeight() + this.getBottomOffset());

    prepareMessagesContainerHeight = value => (this.props.isAnimated ? new Animated.Value(value) : value);

    scrollToBottom(animated = true) {
        if (this.messageContainerRef && this.messageContainerRef.current) {
            this.messageContainerRef.current.scrollTo({ offset: 0, animated });
        }
    }

    renderContainer = () => {
        if (this.props.renderContainer) {
            return this.props.renderContainer(this.renderEvents, this.renderInputToolbar, this.renderBottom);
        }

        return (
            <View style={this.props.style}>
                {this.renderEvents()}
                {this.renderInputToolbar()}
                {this.renderBottom()}
            </View>
        );
    }

    renderEvents = () => {
        const { events } = this.state;
        const AnimatedView = this.props.isAnimated ? Animated.View : View;
        return (
            <AnimatedView style={{ height: this.state.messagesContainerHeight }}>
                <EventsContainer {...this.props} events={events} ref={this.messageContainerRef} />
            </AnimatedView>
        );
    }

    renderInputToolbar = () => {
        const { text, composerHeight } = this.state;
        const { minComposerHeight } = this.props;
        const inputToolbarProps = {
            ...this.props,
            text,
            composerHeight: Math.max(minComposerHeight, composerHeight),
            trans: { ...trans.t('inputToolbar'), ...(this.props.trans.inputToolbar || {}) },
        };
        if (this.props.renderInputToolbar) {
            return this.props.renderInputToolbar(inputToolbarProps);
        }
        return <InputToolbar {...inputToolbarProps} />;
    }

    renderBottom = () => {
        if (this.props.renderBottom) {
            return this.props.renderBottom(this.getBottomOffsetIphoneX);
        }
        return (
            <View style={{ height: this.getBottomOffsetIphoneX }} />
        );
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
    trans: {},
    render: null,
    renderContainer: null,
    locale: 'en',
    roomId: 0,
    possibleChatEvents: PossibleChatEventsTypes,
    possibleChatContentTypes: PossibleChatContentTypes,
    bottomOffset: 0,
    minComposerHeight: Platform.select({ ios: 33, android: 41 }),
    maxComposerHeight: 200,
    onInputTextChanged: null,
    onLoaded: null,
    isAnimated: Platform.select({ ios: true, android: false }),
    renderWithSafeArea: false,
    maxInputLength: null,
    forceGetKeyboardHeight: false,
    minInputToolbarHeight: 44,
    renderInputToolbar: null,
    renderBottom: null,
};

MatrixChat.propTypes = {
    style: PropTypes.object,
    trans: PropTypes.object,
    render: PropTypes.func,
    renderContainer: PropTypes.func,
    locale: PropTypes.string,
    roomId: PropTypes.number,
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
    minInputToolbarHeight: PropTypes.number,
    renderInputToolbar: PropTypes.func,
    renderBottom: PropTypes.func,
};

export default MatrixChat;
