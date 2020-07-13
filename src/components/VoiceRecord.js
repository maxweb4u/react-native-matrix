/**
 * Created by Max Gor on 6/20/20
 *
 * This is voice recording component
 */

import React, { PureComponent } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { timer } from 'rxjs';
import Utils from '../lib/utils';
import Colors from '../lib/colors';
import trans from '../trans';


const styles = {
    voiceContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    actionContainer: { height: 36 },
    voiceCancelText: { color: Colors.blueDark, fontSize: 14 },
    voiceSendText: { color: Colors.blue, fontSize: 14 },
    voiceTimerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' },
    recordLabel: { width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.red },
    voiceTimeText: {paddingLeft: 5, color: Colors.black, fontSize: 12}
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
        const {voiceRecordstyles, showVoiceRecord} = this.props;

        if (!showVoiceRecord) {
            return null;
        }

        return (
            <View style={voiceRecordstyles.voiceContainer}>
                <TouchableOpacity style={voiceRecordstyles.actionContainer} onPress={() => this.cancel()}>
                    <Text style={voiceRecordstyles.voiceCancelText}>{trans.t('voiceRecord', 'cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={voiceRecordstyles.actionContainer} onPress={() => this.stop()}>
                    <Text style={voiceRecordstyles.voiceSendText}>{trans.t('voiceRecord', 'send')}</Text>
                </TouchableOpacity>
                <View style={voiceRecordstyles.voiceTimerContainer}>
                    <View style={voiceRecordstyles.recordLabel} />
                    <Text style={voiceRecordstyles.voiceTimeText}>{Utils.getCountdownTitle(this.state.timeline)}</Text>
                </View>
            </View>
        );
    }
}

VoiceRecord.defaultProps = {
    showVoiceRecord: false,
    cancelRecording: () => {},
    stopRecording: () => {},
    trans: {},
    voiceRecordstyles: styles,
};
VoiceRecord.propTypes = {
    showVoiceRecord: PropTypes.bool,
    cancelRecording: PropTypes.func,
    stopRecording: PropTypes.func,
    trans: PropTypes.object,
    voiceRecordstyles: PropTypes.object,
};

export default VoiceRecord;
