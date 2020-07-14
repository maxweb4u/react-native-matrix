/**
 * Created by Max Gor on 6/20/20
 *
 * This is container for events in a chat
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { FlatList, View, StyleSheet, Keyboard } from 'react-native';
import Event from './Event';
import Utils from '../lib/utils';
import Matrix from '../Matrix';

const styles = StyleSheet.create({
    container: { flex: 1, paddingBottom: 16, },
    // listStyle: { flex: 1 },
    contentContainerStyle: { flexGrow:1, justifyContent: 'flex-end' },
});

class EventsContainer extends Component {
    constructor(props) {
        super(props);
        this.flatListRef = React.createRef();
    }

    // shouldComponentUpdate(nextProps, nextState) {
    //     console.log("-------------------", this.props.events.length, nextProps.events.length)
    //     return this.props.events.length !== nextProps.events.length;
    // }

    scrollToBottom(options){
        if (!options) {
            options = { animated: true };
        }
        if (this.flatListRef && this.flatListRef.current && options) {
            this.flatListRef.current.scrollToEnd(options);
        }
    }

    renderEvent = ({ item, index }) => {
        const { events, eventProps } = this.props;
        const prevEvent = index - 1 >= 0 ? events && events[index - 1] : null;
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
        };
        if (this.props.renderEvent) {
            return this.props.renderEvent(props);
        }
        return <Event {...props} />;
    };

    keyExtractor = item => `${item.id}`;

    render() {
        if (!this.props.events || (this.props.events && this.props.events.length === 0)) {
            return <View style={styles.container} />;
        }
        // console.log("RERENDER EVENTS")
        return (
            <View style={styles.container}>
                <FlatList
                    ref={this.flatListRef}
                    keyExtractor={this.keyExtractor}
                    enableEmptySections
                    data={this.props.events}
                    style={styles.listStyle}
                    contentContainerStyle={styles.contentContainerStyle}
                    renderItem={this.renderEvent}
                    onContentSizeChange={() => this.flatListRef.current.scrollToEnd({animated: true})}
                />
            </View>
        );
    }
}
EventsContainer.defaultProps = {
    events: [],
    reactedEventIds: [],
    renderEvent: null,
    eventProps: {},
    roomId: '',
    startAudioPlay: ()=>{},
    stopAudioPlay: ()=>{},
};
EventsContainer.propTypes = {
    events: PropTypes.arrayOf(PropTypes.object),
    reactedEventIds: PropTypes.arrayOf(PropTypes.string),
    renderEvent: PropTypes.func,
    eventProps: PropTypes.object,
    roomId: PropTypes.string,
    startAudioPlay: PropTypes.func,
    stopAudioPlay: PropTypes.func,
};

export default EventsContainer;
