/**
 * Created by Max Gor on 6/20/20
 *
 * This is container for events in a chat
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { FlatList, View, StyleSheet, ActivityIndicator, Image, Text, TouchableOpacity } from 'react-native';
import Event from './Event';
import InViewPort from './InViewPort';
import Utils from '../lib/utils';
import Colors from '../lib/colors';
import Matrix from '../Matrix';
import trans from '../trans';

const styles = StyleSheet.create({
    container: { flex: 1, paddingBottom: 16 },
    contentContainerStyle: { flexGrow: 1, justifyContent: 'flex-start' },
    loadEarlyContainer: { justifyContent: 'center', alignItems: 'center', marginTop: 10, marginBottom: 10 },
    containerQuote: { width: '100%', backgroundColor: Colors.grey, paddingLeft: 10, paddingTop: 10, paddingBottom: 10, borderLeftWidth: 5, borderColor: Colors.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    containerQuoteInner: {},
    quoteTextAuthor: { fontSize: 12, color: Colors.blue },
    quoteText: { fontSize: 12, color: Colors.greyDark },
    quoteCancelButton: { height: 36, width: 36, alignItems: 'center', justifyContent: 'center' },
    iconCloseCitation: { height: 22, width: 22 },
});

class EventsContainer extends Component {
    constructor(props) {
        super(props);
        this.loading = false;
        this.state = { loadMore: true, isQuote: false, quoteMessage: '', quoteAuthor: '' };
        this.flatListRef = React.createRef();
    }

    getPropsStyle = (style) => {
        if (Object.prototype.hasOwnProperty.call(this.props.eventsStyles, style)) {
            return this.props.eventsStyles[style];
        }
        return null;
    }

    scrollToBottom = (options) => {
        if (!options) {
            options = { animated: true };
        }
        if (this.flatListRef && this.flatListRef.current && options) {
            this.flatListRef.current.scrollToOffset({ offset: 0, ...options });
        }
    }

    addCitation = (quoteMessageToSend, quoteMessage, quoteAuthor) => {
        this.props.addCitation(quoteMessageToSend, quoteMessage, quoteAuthor);
        this.setState({ isQuote: true, quoteMessage, quoteAuthor });
    }

    cancelCitation = () => {
        this.props.cancelCitation();
        this.setState({ isQuote: false });
    }

    messageSent = () => {
        this.setState({ isQuote: false });
    }

    renderEvent = ({ item, index }) => {
        const { events, eventProps } = this.props;
        const prevEvent = index + 1 < events.length ? events[index + 1] : null;
        const event = item;
        const props = {
            ...eventProps,
            event,
            roomId: this.props.roomId,
            isOwn: Matrix.getIsOwn(event.userId),
            isNewDay: !prevEvent || (prevEvent && Utils.isNewDay(event.ts, prevEvent.ts)),
            isPrevUserTheSame: prevEvent && prevEvent.userId === event.userId,
            startAudioPlay: this.props.startAudioPlay,
            stopAudioPlay: this.props.stopAudioPlay,
            reactedEventIds: this.props.reactedEventIds,
            addCitation: this.addCitation,
            trans: this.props.trans,
        };
        if (this.props.renderEvent) {
            return this.props.renderEvent(props);
        }
        return <Event {...props} />;
    };

    keyExtractor = item => `${item.id}`;

    loadEarlierMessages = async (isVisible) => {
        if (isVisible && !this.loading && this.state.loadMore) {
            this.loading = true;
            this.props.loadEarlyMessages().then((res) => {
                this.loading = false;
                if (!res) {
                    this.setState({ loadMore: false });
                }
            }).catch(() => {
                this.loading = false;
                this.setState({ loadMore: false });
            });
        }
    }

    renderHeader = () => {
        if (!this.state.loadMore) {
            return null;
        }
        return (
            <InViewPort onChange={isVisible => this.loadEarlierMessages(isVisible)} active={this.state.loadMore} style={styles.loadEarlyContainer}>
                <ActivityIndicator size="small" />
            </InViewPort>
        );
    }

    renderFooter = () => {
        const { isQuote, quoteAuthor, quoteMessage } = this.state;

        if (this.props.renderQuote) {
            return this.props.renderQuote(isQuote, quoteAuthor, quoteMessage, this.cancelCitation);
        }

        if (!isQuote) {
            return null;
        }

        return (
            <View style={[styles.containerQuote, this.getPropsStyle('containerQuote')]}>
                <View style={[styles.containerQuoteInner, this.getPropsStyle('containerQuoteInner')]}>
                    <Text style={[styles.quoteTextAuthor, this.getPropsStyle('quoteTextAuthor')]}>{quoteAuthor}</Text>
                    <Text style={[styles.quoteText, this.getPropsStyle('quoteText')]}>{quoteMessage}</Text>
                </View>
                <TouchableOpacity style={[styles.quoteCancelButton, this.getPropsStyle('quoteCancelButton')]} onPress={() => this.cancelCitation()}>
                    <Image source={this.props.iconCloseBlue || require('../assets/icon-close-blue.png')} style={[styles.iconCloseCitation, this.getPropsStyle('iconCloseCitation')]} />
                </TouchableOpacity>
            </View>
        );
    }

    render() {
        if (!this.props.events || (this.props.events && this.props.events.length === 0)) {
            return <View style={styles.container} />;
        }
        return (
            <View style={styles.container}>
                <FlatList
                    ref={this.flatListRef}
                    keyExtractor={this.keyExtractor}
                    enableEmptySections
                    data={this.props.events}
                    contentContainerStyle={styles.contentContainerStyle}
                    renderItem={this.renderEvent}
                    ListFooterComponent={this.renderHeader()}
                    ListHeaderComponent={this.renderFooter()}
                    inverted
                />
            </View>
        );
    }
}
EventsContainer.defaultProps = {
    trans,
    eventsStyles: {},
    events: [],
    reactedEventIds: [],
    renderEvent: null,
    renderQuote: null,
    eventProps: {},
    roomId: '',
    startAudioPlay: () => {},
    stopAudioPlay: () => {},
    addCitation: () => {},
    cancelCitation: () => {},
    loadEarlyMessages: () => {},
};
EventsContainer.propTypes = {
    trans: PropTypes.object,
    eventsStyles: PropTypes.object,
    events: PropTypes.arrayOf(PropTypes.object),
    reactedEventIds: PropTypes.arrayOf(PropTypes.string),
    renderEvent: PropTypes.func,
    renderQuote: PropTypes.func,
    eventProps: PropTypes.object,
    roomId: PropTypes.string,
    startAudioPlay: PropTypes.func,
    stopAudioPlay: PropTypes.func,
    addCitation: PropTypes.func,
    cancelCitation: PropTypes.func,
    loadEarlyMessages: PropTypes.func,
};

export default EventsContainer;
