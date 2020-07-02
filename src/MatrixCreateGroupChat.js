/**
 * Created by Max Gor on 6/20/20
 *
 * This is component that shows all rooms for current user
 */

import React, { Component } from 'react';
import { View, FlatList, TextInput, Image, Text, StyleSheet, TouchableOpacity } from 'react-native';
import PropTypes from 'prop-types';
import fileUtils from './lib/fileUtils';
import en from './trans/en';
import Matrix from './Matrix';

const styles = StyleSheet.create({
    containerImage: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', width: '100%', padding: 16 },
    noGroupPhoto: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
});

class MatrixCreateGroupChat extends Component {
    constructor(props) {
        super(props);
        this.state = {
            imageObj: null,
            imageURI: '',
            roomName: '',
            userIdsToInvite: [],
        };
    }

    uploadImage = () => {
        fileUtils.uploadFile({
            callback: (err, imageObj) => {
                if (!err) {
                    this.setState({ imageObj, imageURI: imageObj.uri });
                }
            },
            returnBase64: true,
            trans: { ...en.fileModule, ...this.props.trans },
        });
    }

    renderUploadRoomImage = () => {
        const { roomImage } = this.state;
        if (this.props.renderUploadRoomImage) {
            return this.props.renderUploadRoomImage(roomImage, this.uploadImage.bind(this));
        }
        return (
            <TouchableOpacity style={styles.containerImage} onPress={this.uploadImage.bind(this)}>
                <Image source={roomImage || require('./assets/nophoto-group.png')} style={styles.noGroupPhoto} />
                <Text>Change group image</Text>
            </TouchableOpacity>
        );
    }

    render() {
        return (
            <View style={this.props.style}>
                {this.renderUploadRoomImage()}
            </View>
        );
    }
}

MatrixCreateGroupChat.defaultProps = {
    style: { flex: 1 },
    trans: {},
    renderUploadRoomImage: null,
};

MatrixCreateGroupChat.propTypes = {
    style: PropTypes.object,
    trans: PropTypes.object,
    renderUploadRoomImage: PropTypes.func,
};

export default MatrixCreateGroupChat;
