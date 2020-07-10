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

class MatrixChats extends Component {
    constructor(props) {
        super(props);
        this.state = {
            searchText: '',
            rooms: {},
        };
    }

    componentDidMount() {
        this.subscription = timer(1000).subscribe(() => {
            const rooms = Matrix.getRooms();
            this.setState({ rooms }, () => {
                Matrix.setSyncCallback(this.syncCallback);
                this.props.onLoaded();
            });
        });
    }

    componentWillUnmount() {
        if (this.subscription && this.subscription.unsubscribe) this.subscription.unsubscribe();
    }

    syncCallback = (event, room) => {
        if (room.roomId) {
            const { rooms } = this.state;
            rooms[room.roomId] = new Room({ matrixRoom: room });
            this.setState({ rooms });
        }
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
        const items = Object.values(this.state.rooms);
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
