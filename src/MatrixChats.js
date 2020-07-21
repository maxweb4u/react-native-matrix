/**
 * Created by Max Gor on 6/20/20
 *
 * This is component that shows all rooms for current user
 */

import React, { Component } from 'react';
import { View, FlatList, TextInput } from 'react-native';
import { timer } from 'rxjs';
import PropTypes from 'prop-types';
import Room from './models/Room';
import Matrix from './Matrix';
import getUid from 'get-uid';

class MatrixChats extends Component {
    rooms = {};
    userIdsDM = {};
    constructor(props) {
        super(props);
        this.subscription = null;
        this.setData();
        this.state = {
            searchText: '',
            // rooms: {},
            alwaysNewValue: '',
        };
    }

    componentDidMount() {
        // this.subscription = timer(1000).subscribe(() => this.setRooms());
        this.subscription = timer(1000).subscribe(() => Matrix.setTimelineChatsCallback(this.syncCallback));
        this.props.onLoaded(this.userIdsDM);
    }

    componentWillUnmount() {
        Matrix.removeTimelineChatsCallback();
        if (this.subscription && this.subscription.unsubscribe){
            this.subscription.unsubscribe();
        }
    }

    setData = () => {
        const obj = Matrix.getRoomsForChatsList();
        this.rooms = obj.rooms;
        this.userIdsDM = obj.userIdsDM;
    }

    // setRooms = () => {
    //     const obj = Matrix.getRoomsForChatsList();
    //     this.setState({rooms: obj.rooms}, () => {
    //         Matrix.setTimelineChatsCallback(this.syncCallback);
    //         this.props.onLoaded(obj.userIdsDM);
    //     });
    // }

    syncCallback = (event, matrixRoom) => {
        if (matrixRoom.roomId) {
            const room = Matrix.getRoom({ matrixRoom });
            // if (room.matrixEventCouldBeAdded(event)) {
                // Matrix.setUnread(room, room.unread)
            // }
            this.rooms[matrixRoom.roomId] = room;
            this.setState({alwaysNewValue: getUid()})
        }
        // if (room.roomId) {
        //     const { rooms } = this.state;
        //     rooms[room.roomId] = Matrix.getRoom({ matrixRoom: room });
        //     this.setState({ rooms });
        // }
    }

    searchingChats = (searchText) => {
        this.setState({ searchText });
    }

    renderItem = (obj) => {
        if (this.state.searchText && !obj.item.isFound(this.state.searchText)) {
            return null;
        }

        if (this.props.renderItem) {
            return this.props.renderItem(obj.item);
        }
        return (
            <View />
        );
    }

    renderSearch = () => {
        if (this.props.renderSearch) {
            return this.props.renderSearch(this.searchingChats);
        }
        return (
            <TextInput
                style={this.props.styleSearchInput}
                autoCapitalize="none"
                autoCorrect={false}
                underlineColorAndroid="transparent"
                placeholder="Search"
                onChangeText={searchText => this.searchingChats(searchText)}
                value={this.state.searchText}
                returnKeyType="done"
            />
        );
    }

    keyExtractor = (room, index) => index.toString();

    render() {
        const items = Object.values(this.rooms);
        return (
            <View style={this.props.style}>
                {this.renderSearch()}
                <FlatList
                    ref="flatList"
                    data={items}
                    keyExtractor={this.keyExtractor}
                    renderItem={this.renderItem}
                />
            </View>
        );
    }
}

MatrixChats.defaultProps = {
    style: { flex: 1 },
    styleSearchInput: { width: 200, margin: 10 },
    onLoaded: () => { },
    renderItem: null,
    renderSearch: null,
};

MatrixChats.propTypes = {
    style: PropTypes.object,
    styleSearchInput: PropTypes.object,
    onLoaded: PropTypes.func,
    renderItem: PropTypes.func,
    renderSearch: PropTypes.func,
};

export default MatrixChats;
