/**
 * Created by Max Gor on 6/20/20
 *
 * This is voice recording component
 */

import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity } from 'react-native';
import { timer } from 'rxjs';
import Utils from '../lib/utils';
import Colors from '../lib/colors';

const stylesObj = {
    voiceContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingLeft: 16, paddingRight: 16 },
    actionContainer: { height: 36, alignItems: 'center', justifyContent: 'center' },
    voiceCancelText: { color: Colors.blueDark, fontSize: 14 },
    voiceSendText: { color: Colors.blue, fontSize: 14 },
    voiceTimerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' },
    recordLabel: { width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.red },
    voiceTimeText: { paddingLeft: 5, color: Colors.black, fontSize: 12 },
};

class VoiceRecord extends PureComponent {
    subscription = null;

    constructor(props) {
        super(props);
        this.state = { timeline: 0 };
    }

    componentDidMount() {
        this.subscription = timer(0, 1000).subscribe(() => this.timerUp());
    }

    componentWillUnmount() {
        if (this.subscription && this.subscription.unsubscribe) this.subscription.unsubscribe();
    }

    cancel = () => {
        this.props.cancelRecording();
        this.setState({ timeline: 0 });
    }

    stop = () => {
        this.props.stopRecording(this.state.timeline * 1000);
        this.setState({ timeline: 0 });
    }

    timerUp = () => {
        if (this.props.showVoiceRecord) {
            let { timeline } = this.state;
            timeline += 1;
            this.setState({ timeline });
        }
    }

    render() {
        const { voiceRecordStyles, showVoiceRecord, trans } = this.props;

        if (!showVoiceRecord) {
            return null;
        }
        const styles = voiceRecordStyles ? voiceRecordstyles : stylesObj;
        return (
            <View style={styles.voiceContainer}>
                <TouchableOpacity style={styles.actionContainer} onPress={() => this.cancel()}>
                    <Text style={styles.voiceCancelText}>{trans.voiceRecordCancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionContainer} onPress={() => this.stop()}>
                    <Text style={styles.voiceSendText}>{trans.voiceRecordSend}</Text>
                </TouchableOpacity>
                <View style={styles.voiceTimerContainer}>
                    <View style={styles.recordLabel} />
                    <Text style={styles.voiceTimeText}>{Utils.getCountdownTitle(this.state.timeline)}</Text>
                </View>
            </View>
        );
    }
}

VoiceRecord.defaultProps = {
    trans: {},
    showVoiceRecord: false,
    cancelRecording: () => {},
    stopRecording: () => {},
    trans: {},
    voiceRecordStyles: stylesObj,
};
VoiceRecord.propTypes = {
    showVoiceRecord: PropTypes.bool,
    cancelRecording: PropTypes.func,
    stopRecording: PropTypes.func,
    trans: PropTypes.object,
    voiceRecordStyles: PropTypes.object,
};

export default VoiceRecord;
