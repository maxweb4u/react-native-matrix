/**
 * Created by Max Gor on 6/20/20
 *
 * This is component that shows all rooms for current user
 */

import React, { Component } from 'react';
import { View, FlatList } from 'react-native';
import { timer } from 'rxjs';
import PropTypes from 'prop-types';
import Matrix from './Matrix';

class MatrixChats extends Component {
    constructor(props) {
        super(props);
        this.state = { rooms: [] };
    }

    componentDidMount() {
        this.subscription = timer(1000).subscribe(() => {
            const rooms = Matrix.getRooms();
            this.setState({ rooms }, () => {
                this.props.onLoaded();
            });
        });
    }

    renderItem = (room) => {
        if (this.props.renderItem) {
            return this.props.renderItem(room.item);
        }
        return (
            <View />
        );
    }

    keyExtractor = (room, index) => index.toString();

    render() {
        return (
            <View style={this.props.style}>
                <FlatList
                    ref="flatList"
                    data={this.state.rooms}
                    keyExtractor={this.keyExtractor}
                    renderItem={this.renderItem}
                />
            </View>
        );
    }
}

MatrixChats.defaultProps = {
    style: { flex: 1 },
    onLoaded: () => { },
    renderItem: null,
};

MatrixChats.propTypes = {
    style: PropTypes.object,
    onLoaded: PropTypes.func,
    renderItem: PropTypes.func,
};

export default MatrixChats;
