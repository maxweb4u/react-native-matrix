/**
 * Created by Max Gor on 6/20/20
 *
 * This is component to show m.text message
 */

import React, { PureComponent } from 'react';
import { Image } from 'react-native';
import PropTypes from 'prop-types';
import ContentTextModel from '../models/ContentText';
import Colors from '../lib/colors';
import api from '../api';

class EventAvatar extends PureComponent {
    imageSource = null;

    constructor(props) {
        super(props);
        this.state = { loaded: false };
    }

    async componentDidMount() {
        if (this.props.avatarObj && this.props.avatarObj.serverName && this.props.avatarObj.mediaId) {
            const res = await api.media.downloadFile(this.props.avatarObj.serverName, this.props.avatarObj.mediaId);
            if (res.status) {
                this.source = `data:${this.mimeType};base64,${this.data}`;
                return { status: true };
            }
        }
    }

    getNoPhoto = () => {
        if (this.props.noPhotoSource) {
            return this.props.noPhotoSource;
        }
        return this.props.avatarObj.noPhoto;
    }

    render() {
        const { avatarObj } = this.props;
        return (
            <Image source={this.imageSource ? { uri: this.imageSource } : this.getNoPhoto()} style={this.props.style} />
        );
    }
}

EventAvatar.defaultProps = {
    style: [{ width: 40, height: 40, borderRadius: 20, marginRight: 10 }],
    avatarObj: { },
    noPhotoSource: require('../assets/nophoto.png'),
};
EventAvatar.propTypes = {
    style: PropTypes.arrayOf(PropTypes.object),
    avatarObj: PropTypes.object,
    noPhotoSource: PropTypes.object,
};

export default EventAvatar;
