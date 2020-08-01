/**
 * Created by Max Gor on 6/20/20
 *
 * This is component to show m.audio message
 */

import React, { Component } from 'react';
import { Platform, View, Image, TouchableOpacity, Text } from 'react-native';
import PropTypes from 'prop-types';
import Colors from '../lib/colors';
import Utils from '../lib/utils';

const stylesObj = {
    audioPreview: { paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopLeftRadius: Platform.OS === 'ios' ? 0 : 20, borderTopRightRadius: 20, width: 170 },
    audioPreviewMy: { borderTopLeftRadius: 20, borderTopRightRadius: Platform.OS === 'ios' ? 0 : 20 },
    audioTrackContainer: { height: 2, width: 105, backgroundColor: Colors.grey, borderRadius: 1 },
    audioTrackContainerInner: { height: 2, width: 100, position: 'relative' },
    audioTrack: { height: 10, width: 10, position: 'relative', backgroundColor: Colors.orange, borderRadius: 5, left: 0, top: -4 },
    audioTimeContainer: { alignSelf: 'flex-end', paddingTop: 4 },
    audioTimeText: { fontSize: 12, color: Colors.greyDark },
    audioTimeTextMy: { color: Colors.white },
    audioTrackProgress: { alignItems: 'center', justifyContent: 'center', marginTop: 16, paddingRight: 10 },
    icon32: { width: 32, height: 32 },
    touchArea: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
};

class ContentAudio extends Component {
    constructor(props) {
        super(props);
        this.state = {
            isPlaying: false,
            currentPositionSec: 0,
            currentDurationSec: 0,
            playTime: this.getAllPlayTime(),
        };
    }

    action = () => {
        const { isPlaying } = this.state;

        if (this.props.contentObj.mediaId || this.props.contentObj.appURI) {
            this.setState({ isPlaying: !isPlaying }, () => {
                if (this.state.isPlaying) {
                    const uri = this.props.contentObj.mediaId ? this.props.contentObj.httpURL : this.props.contentObj.fileURI;
                    this.props.startAudioPlay(uri, this.playBack.bind(this), this.removeListener.bind(this));
                } else {
                    this.props.stopAudioPlay();
                }
            });
        }
    }

    playBack = (e) => {
        this.setState({
            currentPositionSec: e.current_position,
            currentDurationSec: e.duration,
            playTime: this.props.contentObj.mmss(Math.floor(e.duration) - Math.floor(e.current_position)),
        });
    }

    getAllPlayTime = () => (this.props.contentObj.timeline ? this.props.contentObj.mmss(this.props.contentObj.timeline) : '00:00');

    removeListener = () => {
        this.setState({ isPlaying: false });
    }

    render() {
        const leftPosition = this.state.currentDurationSec && this.state.currentPositionSec ? this.state.currentPositionSec / this.state.currentDurationSec * 99 : 0;
        const styles = { ...stylesObj, ...this.props.contentAudioStyles };
        const iconPlaying = this.props.icons.pause || require('../assets/icon-player-pause.png')
        const iconNotPlaying = this.props.icons.playing || require('../assets/icon-player-play.png')
        return (
            <View style={[styles.audioPreview, this.props.isOwn && styles.audioPreviewMy]}>
                <TouchableOpacity style={styles.touchArea} onPress={this.action} {...Utils.testProps('btnEventAudioPress')}>
                    <Image source={this.state.isPlaying ? iconPlaying : iconNotPlaying} style={styles.icon32} />
                </TouchableOpacity>
                <View style={styles.audioTrackProgress}>
                    <View style={styles.audioTrackContainer}>
                        <View style={styles.audioTrackContainerInner}>
                            <View style={[styles.audioTrack, { left: leftPosition }]} />
                        </View>
                    </View>
                    <View style={styles.audioTimeContainer}>
                        <Text style={[styles.audioTimeText, this.props.isOwn && styles.audioTimeTextMy]}>{this.state.playTime}</Text>
                    </View>
                </View>
            </View>
        );
    }
}

ContentAudio.defaultProps = {
    contentAudioStyles: stylesObj,
    contentObj: null,
    isOwn: false,
    startAudioPlay: () => {},
    stopAudioPlay: () => {},
    icons: {},
};
ContentAudio.propTypes = {
    contentAudioStyles: PropTypes.object,
    contentObj: PropTypes.object,
    isOwn: PropTypes.bool,
    startAudioPlay: PropTypes.func,
    stopAudioPlay: PropTypes.func,
    icons: PropTypes.object,
};

export default ContentAudio;
