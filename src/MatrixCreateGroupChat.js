/**
 * Created by Max Gor on 6/20/20
 *
 * This is component that shows all rooms for current user
 */

import React, { Component } from 'react';
import { View, TextInput, Image, Text, StyleSheet, TouchableOpacity } from 'react-native';
import PropTypes from 'prop-types';
import fileUtils from './lib/fileUtils';
import Utils from './lib/utils';
import trans from './trans';
import Matrix from './Matrix';

const styles = StyleSheet.create({
    containerImage: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', width: '100%', padding: 16 },
    groupPhoto: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
    titleInput: { width: '90%', margin: 16 },
    containerContacts: { flex: 1 },
    containerButton: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: 100 },
    button: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '90%', height: 40, borderRadius: 20, borderWidth: 0.5, borderColor: '#ccc' },
});

class MatrixCreateGroupChat extends Component {
    constructor(props) {
        super(props);
        trans.setLocale(this.props.locale);
        trans.setTransFromProps(this.props.trans);
        this.state = {
            imageObj: null,
            imageURI: '',
            title: '',
            userIdsToInvite: this.props.preselectedUserIds,
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
            trans: trans.t('fileModule'),
        });
    }

    changeTitle = title => this.setState({ title });

    changeContacts = userIdsToInvite => this.setState({ userIdsToInvite });

    createRoom = async ({ defaultTitle }) => {
        const { userIdsToInvite, title, imageURI, imageObj } = this.state;
        if (!userIdsToInvite.length) {
            return { status: false, msg: 'usersNotSelected' };
        }
        console.log(userIdsToInvite)
        const roomTitle = !title ? defaultTitle : title;
        const res = await Matrix.createRoom(userIdsToInvite, roomTitle);
        if (!res.status) {
            return res;
        }
        if (imageURI) {
            Matrix.saveImageForRoom(res.data.room_id, imageObj);
        }
        return { status: true, roomId: res.data.room_id, roomTitle };
    }

    renderUploadRoomImage = () => {
        const { imageURI } = this.state;
        if (this.props.renderUploadRoomImage) {
            return this.props.renderUploadRoomImage(imageURI, this.uploadImage.bind(this));
        }
        return (
            <TouchableOpacity style={styles.containerImage} onPress={this.uploadImage.bind(this)}>
                <Image source={imageURI ? { uri: imageURI } : require('./assets/nophoto-group.png')} style={styles.groupPhoto} />
                <Text>{trans.t('createGroupChat', 'changeGroupImage')}</Text>
            </TouchableOpacity>
        );
    }

    renderGroupTitle = () => {
        const { title } = this.state;
        if (this.props.renderGroupTitle) {
            return this.props.renderGroupTitle(title, this.changeTitle.bind(this));
        }
        return (
            <TextInput
                style={styles.titleInput}
                autoCapitalize="none"
                autoCorrect={false}
                underlineColorAndroid="transparent"
                placeholder={trans.t('createGroupChat', 'inputPlaceholder')}
                onChangeText={val => this.changeTitle(val)}
                value={title}
                returnKeyType="done"
            />
        );
    }

    renderContacts = () => {
        const { userIdsToInvite } = this.state;
        if (this.props.renderContacts) {
            return this.props.renderContacts(userIdsToInvite, this.changeContacts.bind(this));
        }
        return (
            <View style={styles.containerContacts} />
        );
    }

    renderActions = () => {
        if (this.props.renderActions) {
            return this.props.renderActions(this.createRoom.bind(this));
        }
        return (
            <View style={styles.containerButton}>
                <TouchableOpacity style={styles.button} onPress={this.createRoom.bind(this)} {...Utils.testProps('btnClickAction')}>
                    <Text>{trans.t('createGroupChat', 'buttonTitle')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    render() {
        if (this.props.render) {
            return this.props.render(this.renderUploadRoomImage.bind(this), this.renderGroupTitle.bind(this), this.renderContacts.bind(this), this.renderActions.bind(this));
        }
        return (
            <View style={this.props.style}>
                {this.renderUploadRoomImage()}
                {this.renderGroupTitle()}
                {this.renderContacts()}
                {this.renderActions()}
            </View>
        );
    }
}

MatrixCreateGroupChat.defaultProps = {
    style: { flex: 1 },
    trans: null,
    render: null,
    renderUploadRoomImage: null,
    renderGroupTitle: null,
    renderContacts: null,
    renderActions: null,
    locale: 'en',
    preselectedUserIds: [],
};

MatrixCreateGroupChat.propTypes = {
    style: PropTypes.object,
    trans: PropTypes.object,
    render: PropTypes.func,
    renderUploadRoomImage: PropTypes.func,
    renderGroupTitle: PropTypes.func,
    renderContacts: PropTypes.func,
    renderActions: PropTypes.func,
    locale: PropTypes.string,
    preselectedUserIds: PropTypes.array,
};

export default MatrixCreateGroupChat;
