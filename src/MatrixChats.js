/**
 * Created by Max Gor on 6/20/20
 *
 * This is component that shows all rooms for current user
 */

import React, { Component } from 'react';
import { View, FlatList, Text } from 'react-native';
import PropTypes from 'prop-types';
import Matrix from './Matrix';

class MatrixChats extends Component {
    constructor(props) {
        super(props);
        this.state = { loading: true };
    }

    componentDidMount() {
        const rooms = Matrix.getRooms();
        this.setState({ loading: false }, () => {
            this.props.onLoaded();
        });
    }

    render() {
        return (
            <View style={this.props.style}>

            </View>
        );
    }
}

MatrixChats.defaultProps = {
    accessToken: '',
    userId: '',
    style: {},
    onLoaded: () => { },
}

MatrixChats.propTypes = {
    accessToken: PropTypes.string,
    userId: PropTypes.string,
    style: PropTypes.object,
    onLoaded: PropTypes.func,
}

export default MatrixChats;
