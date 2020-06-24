/**
 * Created by Max Gor on 6/20/20
 *
 * This is component that shows all rooms for current user
 */

import React from 'react';
import { View, FlatList, Text } from 'react-native';

class MatrixChats extends ParentScreen {
    constructor(props) {
        super(props);
        this.state = { loading: true };
    }

    render() {
        return (
            <View style={this.props.style}>
                <Text>test</Text>
            </View>
        );
    }
}

export default MatrixChats;
