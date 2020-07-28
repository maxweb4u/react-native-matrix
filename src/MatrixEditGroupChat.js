/**
 * Created by Max Gor on 6/20/20
 *
 * This is component that allows you to edit the group data
 */

import React, { Component } from 'react';
import { View, TextInput, Image, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import PropTypes from 'prop-types';
import fileUtils from './lib/fileUtils';
import trans from './trans';
import Matrix from './Matrix';
import LeftX from './components/LeftX';

const styles = StyleSheet.create({
    containerImage: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', width: '100%', padding: 16 },
    groupPhoto: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
    titleInput: { width: '90%', margin: 16 },
    containerContacts: { top: 0, left: Dimensions.get('window').width, width: '100%' },
    containerMembers: { height: 200 },
    containerExitButton: { flex: 1, paddingTop: 20 },
    containerButton: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: 100 },
    buttonExit: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: 40, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#ccc' },
    button: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '90%', height: 40, borderRadius: 20, borderWidth: 0.5, borderColor: '#ccc' },
});

class MatrixEditGroupChat extends Component {
    constructor(props) {
        super(props);
        trans.setLocale(this.props.locale);
        trans.setTransFromProps(this.props.trans);
        this.room = this.props.room;
        if (!this.room && this.props.roomId) {
            this.room = Matrix.getRoom({ roomId: this.props.roomId });
        }
        this.state = {
            imageObj: null,
            imageURI: this.room.avatar,
            title: this.room ? this.room.title : '',
            members: this.room ? this.room.allMembers : {},
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

    changeRoom = async () => {
        const { title, imageObj } = this.state;
        let isUpdated = false;
        if (this.room.title !== title) {
            Matrix.changeRoomTitle(this.room.id, title);
            isUpdated = true;
        }
        if (imageObj) {
            Matrix.saveImageForRoom(this.room.id, imageObj);
            isUpdated = true;
        }
        if (isUpdated) {
            this.room.recalculate();
        }
        return title;
    }

    // return true if you leave room
    exitRoom = async () => {
        const res = await Matrix.exitFromRoom(this.room.id);
        return res.status;
    }

    addContacts = async (matrixUserIds) => {
        const status = await Matrix.inviteNewMembers(this.room.id, matrixUserIds);
        if (status) {
            this.room.recalculate();
        }
    }

    renderUploadRoomImage = () => {
        const { imageURI } = this.state;
        if (this.props.renderUploadRoomImage) {
            return this.props.renderUploadRoomImage(imageURI, this.uploadImage.bind(this));
        }
        return (
            <TouchableOpacity style={styles.containerImage} onPress={this.uploadImage.bind(this)}>
                <Image source={imageURI || require('./assets/nophoto-group.png')} style={styles.groupPhoto} />
                <Text>{trans.t('editGroupChat', 'changeGroupImage')}</Text>
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
                placeholder={trans.t('editGroupChat', 'inputPlaceholder')}
                onChangeText={val => this.changeTitle(val)}
                value={title}
                returnKeyType="done"
            />
        );
    }

    renderMembers = () => {
        if (this.props.renderMembers) {
            return this.props.renderMembers(this.state.members);
        }
        return (
            <View style={styles.containerMembers} />
        );
    }

    renderContacts = () => (
        <View style={styles.containerContacts} />
    )

    renderExitRoom = () => {
        if (this.props.renderExitRoom) {
            return this.props.renderExitRoom(this.exitRoom.bind(this));
        }
        return (
            <View style={styles.containerExitButton}>
                <TouchableOpacity style={styles.buttonExit} onPress={this.exitRoom.bind(this)}>
                    <Text>{trans.t('editGroupChat', 'buttonTitle')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    renderActions = () => {
        if (this.props.renderActions) {
            return this.props.renderActions(this.changeRoom.bind(this));
        }
        return (
            <View style={styles.containerButton}>
                <TouchableOpacity style={styles.button} onPress={this.changeRoom.bind(this)}>
                    <Text>{trans.t('editGroupChat', 'buttonLeave')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    renderContactsContainer = () => {
        if (this.props.renderContactsContainer) {
            return this.props.renderContactsContainer(this.state.members, this.addContacts.bind(this));
        }
        return (
            <LeftX ref="animationSearch" duration={400} fromValue={Dimensions.get('window').width} toValue={0} style={styles.containerContacts}>
                {this.renderContacts()}
            </LeftX>
        );
    }

    render() {
        if (this.props.render) {
            return this.props.render(this.renderUploadRoomImage.bind(this), this.renderGroupTitle.bind(this), this.renderContacts.bind(this), this.renderExitRoom.bind(this), this.renderActions.bind(this));
        }
        return (
            <View style={this.props.style}>
                {this.renderUploadRoomImage()}
                {this.renderGroupTitle()}
                {this.renderMembers()}
                {this.renderExitRoom()}
                {this.renderActions()}
                {this.renderContactsContainer()}
            </View>
        );
    }
}

MatrixEditGroupChat.defaultProps = {
    style: { flex: 1, position: 'relative' },
    trans: null,
    render: null,
    renderUploadRoomImage: null,
    renderGroupTitle: null,
    renderContactsContainer: null,
    renderActions: null,
    renderExitRoom: null,
    renderMembers: null,
    locale: 'en',
    roomId: null,
    room: null,
};

MatrixEditGroupChat.propTypes = {
    style: PropTypes.object,
    trans: PropTypes.object,
    render: PropTypes.func,
    renderUploadRoomImage: PropTypes.func,
    renderGroupTitle: PropTypes.func,
    renderContactsContainer: PropTypes.func,
    renderActions: PropTypes.func,
    renderExitRoom: PropTypes.func,
    renderMembers: PropTypes.func,
    locale: PropTypes.string,
    roomId: PropTypes.string,
    room: PropTypes.object,
};

export default MatrixEditGroupChat;
