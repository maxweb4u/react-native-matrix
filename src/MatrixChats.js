/**
 * Created by Max Gor on 6/20/20
 *
 * This is component that shows all rooms for current user
 */

import React, { Component } from 'react';
import { View, FlatList, Text } from 'react-native';
import PropTypes from 'prop-types';

class MatrixChats extends Component {
    constructor(props) {
        super(props);
        this.state = { loading: true };
    }

    async componentDidMount() {
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
