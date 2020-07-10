/**
 * Created by Max Gor on 6/20/20
 *
 * This is container for events in a chat
 */

import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { FlatList, View, StyleSheet, Keyboard } from 'react-native';
import Event from './Event';
import Utils from '../lib/utils';
import Matrix from '../Matrix';

const styles = StyleSheet.create({
    container: { flex: 1 },
    listStyle: { flex: 1 },
    contentContainerStyle: { justifyContent: 'flex-end' },
});

class EventsContainer extends PureComponent {
    constructor(props) {
        super(props);
        this.flatListRef = React.createRef();
    }

    componentDidMount() {
        if (this.props.events && this.props.events.length === 0) {
            this.attachKeyboardListeners();
        }
    }

    componentWillUnmount() {
        this.detachKeyboardListeners();
    }

    getDerivedStateFromProps(nextProps, prevState) {
        const { prevProps } = prevState;
        if (prevProps.events && prevProps.events.length === 0 && nextProps.events && nextProps.events.length > 0) {
            this.detachKeyboardListeners();
        } else if (prevProps.messages && nextProps.events && this.props.events.length > 0 && nextProps.events.length === 0) {
            this.attachKeyboardListeners();
        }
        return { prevProps: nextProps };
    }

    attachKeyboardListeners = () => {
        const { keyboardListeners } = this.props;
        if (keyboardListeners) {
            Keyboard.addListener('keyboardWillShow', keyboardListeners.onKeyboardWillShow);
            Keyboard.addListener('keyboardDidShow', keyboardListeners.onKeyboardDidShow);
            Keyboard.addListener('keyboardWillHide', keyboardListeners.onKeyboardWillHide);
            Keyboard.addListener('keyboardDidHide', keyboardListeners.onKeyboardDidHide);
        }
    }

    detachKeyboardListeners = () => {
        const { keyboardListeners } = this.props;
        if (keyboardListeners) {
            Keyboard.removeListener('keyboardWillShow', keyboardListeners.onKeyboardWillShow);
            Keyboard.removeListener('keyboardDidShow', keyboardListeners.onKeyboardDidShow);
            Keyboard.removeListener('keyboardWillHide', keyboardListeners.onKeyboardWillHide);
            Keyboard.removeListener('keyboardDidHide', keyboardListeners.onKeyboardDidHide);
        }
    }

    renderEvent = ({ item, index }) => {
        const { events } = this.props;
        const prevEvent = index - 1 >= 0 ? events && events[index - 1] : null;
        const event = item.item;
        const eventProps = {
            event,
            isOwn: Matrix.getIsOwn(event.userId),
            isNewDay: !prevEvent || (prevEvent && Utils.isNewDay(event.ts, prevEvent.ts)),
            isPrevUserTheSame: prevEvent && prevEvent.userId === event.userId,
        };
        if (this.props.renderEvent) {
            return this.props.renderEvent(eventProps);
        }
        return <Event {...eventProps} {...this.props.eventProps} />;
    };

    keyExtractor = item => `${item.id}`;

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
                    automaticallyAdjustContentInsets={false}
                    data={this.props.events}
                    style={styles.listStyle}
                    contentContainerStyle={styles.contentContainerStyle}
                    renderItem={this.renderEvent}
                    scrollEventThrottle={100}
                />
            </View>
        );
    }
}
EventsContainer.defaultProps = {
    events: [],
    keyboardListeners: null,
    renderEvent: null,
    eventProps: {},
};
EventsContainer.propTypes = {
    events: PropTypes.arrayOf(PropTypes.object),
    keyboardListeners: PropTypes.object,
    renderEvent: PropTypes.func,
    eventProps: PropTypes.object,
};

export default EventsContainer;
