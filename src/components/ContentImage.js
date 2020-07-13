/**
 * Created by Max Gor on 6/20/20
 *
 * This is component to show m.image message
 */

import React, { Component } from 'react';
import { StyleSheet, Platform, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import PropTypes from 'prop-types';
import ContentImageModel from '../models/ContentImage';

const styles = StyleSheet.create({
    imagePreviewNotMy: {
        borderTopLeftRadius: Platform.OS === 'ios' ? 0 : 20,
        borderTopRightRadius: 20,
        width: 150,
        height: 150,
    },
    imagePreviewMy: {
        width: 150,
        height: 150,
        borderTopLeftRadius: 20,
        borderTopRightRadius: Platform.OS === 'ios' ? 0 : 20,
    },
});

class ContentImage extends Component {
    imageSource = null;

    constructor(props) {
        super(props);
        this.state = { loaded: false };
    }

    async componentDidMount() {
        if (this.props.contentObj) {
            const res = await this.props.contentObj.getFile();
            if (res.status) {
                this.imageSource = res.data;
                this.setState({ loaded: true });
            }
        }
    }

    onPress = () => {
        if (this.props.onImagePress) {
            this.props.onImagePress(this.props.contentObj)
        }
    }

    render() {
        if (!this.state.loaded || !this.imageSource) {
            <ActivityIndicator size="small" />
        }
        return (
            <TouchableOpacity style={this.props.isOwn ? this.props.imagePreviewMy : this.props.imagePreviewNotMy} onPress={() => this.onPress()}>
                <Image source={{ uri: this.imageSource }} style={this.props.isOwn ? this.props.imagePreviewMy : this.props.imagePreviewNotMy} />
            </TouchableOpacity>
        );
    }
}

ContentImage.defaultProps = {
    imagePreviewNotMy: styles.imagePreviewNotMy,
    imagePreviewMy: styles.imagePreviewMy,
    contentObj: null,
    isOwn: false,
    onImagePress: null,
};
ContentImage.propTypes = {
    imagePreviewNotMy: PropTypes.object,
    imagePreviewMy: PropTypes.object,
    contentObj: PropTypes.object,
    isOwn: PropTypes.bool,
    onImagePress: PropTypes.func,
};

export default ContentImage;
