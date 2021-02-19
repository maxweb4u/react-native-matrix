/**
 * Created by Max Gor on 6/20/20
 *
 * This is component that shows all rooms for current user
 */

import React, { Component } from 'react';
import { View, FlatList, TextInput } from 'react-native';
import { timer } from 'rxjs';
import PropTypes from 'prop-types';
import getUid from 'get-uid';
import Utils from './lib/utils';
import Matrix from './Matrix';

class MatrixChats extends Component {
    rooms = {};

    userIdsDM = {};

    constructor(props) {
        super(props);
        this.subscription = null;
        this.setData();
        this.state = {
            searchText: '',
            alwaysNewValue: '',
        };
    }

    async componentDidMount() {
        this.subscription = timer(1000).subscribe(() => Matrix.setTimelineChatsCallback(this.syncCallback));
        const totalRooms = this.rooms ? Object.keys(this.rooms).length : null;
        await this.props.onLoaded({ userIdsDM: this.userIdsDM, totalRooms });
    }

    shouldComponentUpdate(nextProps, nextState) {
        const shouldBeRefreshed = nextProps.shouldBeRefreshed && nextProps.shouldBeRefreshed !== this.props.shouldBeRefreshed;
        if (shouldBeRefreshed) {
            this.setData();
        }
        return shouldBeRefreshed || (this.state.searchText !== nextState.searchText) || (this.state.alwaysNewValue !== nextState.alwaysNewValue);
    }

    componentWillUnmount() {
        Matrix.removeTimelineChatsCallback();
        if (this.subscription && this.subscription.unsubscribe) {
            this.subscription.unsubscribe();
        }
    }

    setData = () => {
        const obj = Matrix.getRoomsForChatsList();
        this.rooms = obj.rooms;
        this.userIdsDM = obj.userIdsDM;
    }

    syncCallback = (event, matrixRoom) => {
        if (matrixRoom && matrixRoom.roomId) {
            const room = Matrix.getRoom({ matrixRoom });
            this.rooms[matrixRoom.roomId] = room;
            this.refreshList();
        }
    }

    refreshList = () => {
        if (this.props.isShown()) {
            this.setState({ alwaysNewValue: getUid() });
        }
    }

    searchingChats = (searchText) => {
        this.setState({ searchText });
    }

    acceptInvite = async (roomId) => {
        if (roomId) {
            const matrixRoom = await Matrix.joinRoom(roomId);
            if (matrixRoom) {
                this.syncCallback(matrixRoom);
                return true;
            }
        }
        return false;
    }

    declineInvite = async (roomId) => {
        if (roomId) {
            const isExited = await Matrix.exitFromRoom(roomId);
            if (isExited) {
                delete this.rooms[roomId];
                this.refreshList();
                return true;
            }
        }
        return false;
    }

    renderItem = (obj, i) => {
        if (this.state.searchText && !obj.item.isFound(this.state.searchText)) {
            return null;
        }

        if (this.props.renderItem) {
            return this.props.renderItem(obj.item, i, this.acceptInvite, this.declineInvite);
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
                {...Utils.testProps('inputSearch')}
            />
        );
    }

    renderEmptyList = () => {
        if (this.props.renderEmptyList) {
            return this.props.renderEmptyList();
        }
        return <View style={this.props.style} />;
    }

    keyExtractor = (room, index) => index.toString();

    render() {
        const items = Object.values(this.rooms);
        items.sort((room1, room2) => room1.lastActiveEventTimestamp < room2.lastActiveEventTimestamp || room2.isInvite);
        if (!items.length) {
            this.renderEmptyList();
        }
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
    renderEmptyList: null,
    shouldBeRefreshed: '',
    isShown: () => true,
};

MatrixChats.propTypes = {
    style: PropTypes.object,
    styleSearchInput: PropTypes.object,
    onLoaded: PropTypes.func,
    renderItem: PropTypes.func,
    renderSearch: PropTypes.func,
    renderEmptyList: PropTypes.func,
    shouldBeRefreshed: PropTypes.string,
    isShown: PropTypes.func,
};

export default MatrixChats;
