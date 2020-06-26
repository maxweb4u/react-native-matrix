/**
 * Created by Max Gor on 6/20/20
 *
 * This is component that shows all rooms for current user
 */

import React, { Component } from 'react';
import { View, FlatList, Text } from 'react-native';
import { timer } from 'rxjs';
import PropTypes from 'prop-types';
import Matrix from './Matrix';

class MatrixChats extends Component {
    constructor(props) {
        super(props);
        this.state = {
            rooms: [],
            loading: true
        };
    }

    componentDidMount() {
        this.subscription = timer(1000).subscribe(() => {
            const rooms = Matrix.getRooms();
            this.setState({ rooms, loading: false }, () => {
                this.props.onLoaded();
            });
        });
    }

    renderItem = (room) => {
        if (this.props.renderItem) {
            return this.props.renderItem(room);
        }
        return (
            <View>

            </View>
        )
    }

    keyExtractor = (room, index) => index;

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
    style: {},
    onLoaded: () => { },
    renderItem: null,
    formatDate: 'DD.MM.YYYY',
}

MatrixChats.propTypes = {
    style: PropTypes.object,
    onLoaded: PropTypes.func,
    renderItem: PropTypes.func,
    formatDate: PropTypes.string,
}

export default MatrixChats;
