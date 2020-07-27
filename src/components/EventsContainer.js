/**
 * Created by Max Gor on 6/20/20
 *
 * This is container for events in a chat
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { FlatList, View, StyleSheet, Keyboard, ActivityIndicator } from 'react-native';
import Event from './Event';
import InViewPort from './InViewPort';
import Utils from '../lib/utils';
import Matrix from '../Matrix';
import trans from '../trans';

const styles = StyleSheet.create({
    container: { flex: 1, paddingBottom: 16 },
    contentContainerStyle: { flexGrow: 1, justifyContent: 'flex-start' },
    loadEarlyContainer: { justifyContent: 'center', alignItems: 'center', marginTop: 10, marginBottom: 10},
});

class EventsContainer extends Component {
    constructor(props) {
        super(props);
        this.loading = false;
        this.state = { loadMore: false };
        this.flatListRef = React.createRef();
    }

    scrollToBottom(options) {
        if (!options) {
            options = { animated: true };
        }
        if (this.flatListRef && this.flatListRef.current && options) {
            this.flatListRef.current.scrollToOffset({offset: 0, ...options});
        }
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
            addCitation: this.props.addCitation,
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
            this.props.loadEarlyMessages().then(res => {
                this.loading = false;
                if (!res) {
                    this.setState({loadMore: false});
                }
            }).catch((e) => {
                this.loading = false;
                this.setState({loadMore: false});
            });
        }
    }

    renderHeader = () => {
        return (
            <InViewPort onChange={isVisible => this.loadEarlierMessages(isVisible)} active={this.state.loadMore} style={styles.loadEarlyContainer}>
                <ActivityIndicator size="small" />
            </InViewPort>
        )
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
                    ListFooterComponent={this.state.loadMore ? this.renderHeader : null}
                    inverted={true}
                />
            </View>
        );
    }
}
EventsContainer.defaultProps = {
    trans: trans,
    events: [],
    reactedEventIds: [],
    renderEvent: null,
    eventProps: {},
    roomId: '',
    startAudioPlay: () => {},
    stopAudioPlay: () => {},
    addCitation: () => {},
    loadEarlyMessages: () => {},
};
EventsContainer.propTypes = {
    trans: PropTypes.object,
    events: PropTypes.arrayOf(PropTypes.object),
    reactedEventIds: PropTypes.arrayOf(PropTypes.string),
    renderEvent: PropTypes.func,
    eventProps: PropTypes.object,
    roomId: PropTypes.string,
    startAudioPlay: PropTypes.func,
    stopAudioPlay: PropTypes.func,
    addCitation: PropTypes.func,
    loadEarlyMessages: PropTypes.func,
};

export default EventsContainer;
