/**
 * Created by Max Gor on 6/20/20
 *
 * This is component to show m.text message
 */

import React, { PureComponent } from 'react';
import { Image } from 'react-native';
import PropTypes from 'prop-types';
import ContentFile from '../models/ContentFile';
import Colors from '../lib/colors';
import api from '../api';

class EventAvatar extends PureComponent {
    // imageSource = null;

    constructor(props) {
        super(props);
        this.state = { uri: '' };
    }

    async componentDidMount() {
        if (this.props.avatarObj && this.props.avatarObj.serverName && this.props.avatarObj.mediaId) {
            this.setState({ uri: ContentFile.getHTTPURI(this.props.avatarObj.serverName, this.props.avatarObj.mediaId)});
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
            <Image source={this.state.uri ? { uri: this.state.uri } : this.getNoPhoto()} style={this.props.style} />
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
