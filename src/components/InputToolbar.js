/**
 * Created by Max Gor on 6/20/20
 *
 * This is input toolbar component
 */

import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { View, StyleSheet, Keyboard, TouchableOpacity, TextInput, Image, Platform, Modal, TouchableWithoutFeedback } from 'react-native';
import getUid from 'get-uid';
import SoundRecorder from 'react-native-sound-recorder';
import EmojiSelector from 'react-native-emoji-selector';
import Colors from '../lib/colors';
import FileUtils from '../lib/fileUtils';
import Utils from '../lib/utils';
import MsgTypes from '../consts/MsgTypes';
import VoiceRecord from './VoiceRecord';
import trans from '../trans';

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        backgroundColor: Colors.white,
        width: '100%',
        paddingTop: 10,
        paddingBottom: 10,
    },
    containerAddActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' },
    containerAddFiles: { alignItems: 'center', justifyContent: 'center', width: 60, height: 40 },
    containerAddSmiles: { alignItems: 'center', justifyContent: 'center', width: 40, height: 36 },
    containerAddAudio: { alignItems: 'center', justifyContent: 'center', width: 40, height: 40 },
    containerAddImage: { alignItems: 'center', justifyContent: 'center', width: 40, height: 40 },
    containerSend: { alignItems: 'center', justifyContent: 'center', width: 60, height: 40 },
    iconActionsAddFiles: { width: 30, height: 30 },
    iconActionsAddSmiles: { width: 24, height: 24 },
    iconActionsAddAudio: { width: 24, height: 24 },
    iconActionsAddImage: { width: 24, height: 24 },
    iconActionsSend: { width: 30, height: 30 },
    containerTextInput: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', borderRadius: 25, backgroundColor: Colors.greyLight, padding: 5 },
    textInput: { flex: 1, marginRight: 10, marginLeft: 10, color: Colors.black, lineHeight: 20 },
    containerTouchEmojis: { flex: 1 },
    containerTouchEmojisInner: { flex: 1, backgroundColor: Colors.blackTransparent, justifyContent: 'flex-end' },
    containerEmojis: { width: '100%', backgroundColor: Colors.white, height: 500 },
});

class InputToolbar extends PureComponent {
    constructor(props) {
        super(props);
        this.contentSize = undefined;
        this.state = {
            text: '',
            quoteMessageToSend: '',
            showRecordAudio: false,
            showEmojis: false,
            isQuote: false,
        };
    }

    componentDidMount() {
        this.keyboardWillShowListener = Keyboard.addListener('keyboardWillShow', this.keyboardWillShow);
        this.keyboardWillHideListener = Keyboard.addListener('keyboardWillHide', this.keyboardWillHide);
        // this.keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', this.keyboardDidShow);
        // this.keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', this.keyboardDidHide);
    }

    componentWillUnmount() {
        if (this.keyboardWillShowListener) {
            this.keyboardWillShowListener.remove();
        }
        if (this.keyboardWillHideListener) {
            this.keyboardWillHideListener.remove();
        }
        // if (this.keyboardDidShowListener) {
        //     this.keyboardDidShowListener.remove();
        // }
        // if (this.keyboardDidHideListener) {
        //     this.keyboardDidHideListener.remove();
        // }
    }

    keyboardWillShow = (e) => {
        if (this.props.keyboardListeners.onKeyboardWillShow) {
            this.props.keyboardListeners.onKeyboardWillShow(e);
        }
    }

    keyboardWillHide = (e) => {
        if (this.props.keyboardListeners.onKeyboardWillHide) {
            this.props.keyboardListeners.onKeyboardWillHide(e);
        }
    }

    // keyboardDidShow = (e) => {
    //     if (this.props.keyboardListeners.onKeyboardDidShow) {
    //         this.props.keyboardListeners.onKeyboardDidShow(e);
    //     }
    // }
    //
    // keyboardDidHide = (e) => {
    //     if (this.props.keyboardListeners.onKeyboardDidHide) {
    //         this.props.keyboardListeners.onKeyboardDidHide(e);
    //     }
    // }

    getPropsStyle = (style) => {
        if (Object.prototype.hasOwnProperty.call(this.props.inputToolbarStyles, style)) {
            return this.props.inputToolbarStyles[style];
        }
        return null;
    }

    setLoadingState = (val) => {
        this.props.setLoading(val);
    }

    openCamera = () => {
        FileUtils.getFileFromCamera(this.uploadCallback, this.setLoadingState, this.props.resizeX, this.props.resizeY, this.props.imageQuality);
    }

    openGallery = () => {
        FileUtils.getFileFromGallery(this.uploadCallback, this.setLoadingState, this.props.resizeX, this.props.resizeY, this.props.imageQuality, this.props.trans.fileModule);
    }

    openFile = () => {
        FileUtils.getPDFFile(this.uploadCallback, this.setLoadingState);
    }

    openActions = (showUploadPDF) => {
        if (this.props.showInputbarActions) {
            this.props.showInputbarActions(this.openCamera.bind(this), this.openGallery.bind(this), this.openFile, Object.keys(this.props.members));
            return null;
        }
        FileUtils.uploadFile({ callback: this.uploadCallback, setLoadingState: this.setLoadingState, resizeX: 1000, resizeY: 1600, returnBase64: true, showUploadPDF });
        return null;
    }

    uploadCallback = async (error, res) => {
        this.setLoadingState(false);
        if (error) {
            return null;
        }
        if (res) {
            if (res.type === 'image/jpeg') {
                await this.props.sendMessage.file(MsgTypes.mImage, res.filename, res.uri, res.type, res.base64);
            } else {
                await this.props.sendMessage.file(MsgTypes.mFile, res.filename, res.uri, res.type, res.base64, res.size);
            }
        }

        return null;
    }

    addAudio = async (uri, size, base64, duration) => {
        const filename = `${getUid()}.mp4`;
        await this.props.sendMessage.file(MsgTypes.mAudio, filename, uri, 'video/mp4', base64, size, duration);
    }

    addSmiles = async (smile) => {
        this.setState({ showEmojis: false });
        await this.props.sendMessage.text(smile);
    }

    addText = async () => {
        let message = this.state.text;
        if (message) {
            const { isQuote, quoteMessageToSend } = this.state;
            if (isQuote) {
                message = `${quoteMessageToSend}\n${message}`;
            }
            this.setState({ text: '', isQuote: false });
            this.props.messageSent();
            await this.props.sendMessage.text(message, isQuote);
        }
    }

    onContentSizeChange = (e) => {
        const { contentSize } = e.nativeEvent;
        if (!contentSize) {
            return;
        }
        if (!this.contentSize || (this.contentSize && (this.contentSize.width !== contentSize.width || this.contentSize.height !== contentSize.height))) {
            this.contentSize = contentSize;
            this.props.onInputSizeChanged(this.contentSize);
        }
    };

    onChangeText = (text) => {
        if (this.props.onInputTextChanged) {
            this.props.onInputTextChanged(text);
        }
        this.setState({ text });
    };

    startRecording = () => {
        SoundRecorder.start(`${SoundRecorder.PATH_CACHE}/temp.mp4`)
            .then(() => this.setState({ showRecordAudio: true }))
            .catch(e => e);
    }

    stopRecording = (duration) => {
        this.setState({ showRecordAudio: false }, () => {
            SoundRecorder.stop()
                .then(result => FileUtils.readFile(result.path)
                    .then(data => ({ base64: data, filePath: result.path })).catch(e => e))
                .then(obj => FileUtils.getFileInfo(obj.filePath)
                    .then(fileInfo => ({ filePath: obj.filePath, fileInfo, base64: obj.base64 })).catch(e => e))
                .then((obj) => {
                    if (Object.prototype.hasOwnProperty.call(obj.fileInfo, 'size') && obj.base64) {
                        this.addAudio(obj.filePath, obj.fileInfo.size, obj.base64, duration);
                    }
                })
                .catch(e => e);
        });
    }

    cancelRecording = () => {
        if (this.state.showRecordAudio) {
            SoundRecorder.stop();
            this.setState({ showRecordAudio: false });
        }
    }

    showEmojis = showEmojis => this.setState({ showEmojis });

    addCitation = (quoteMessageToSend) => {
        this.setState({ quoteMessageToSend, isQuote: true });
    }

    cancelCitation = () => {
        this.setState({ isQuote: false });
    }

    renderRecordAudio = () => {
        if (this.props.renderRecordAudio) {
            return this.props.renderRecordAudio();
        }

        return (
            <VoiceRecord
                showVoiceRecord={this.state.showRecordAudio}
                cancelRecording={this.cancelRecording}
                stopRecording={this.stopRecording}
                voiceRecordStyles={this.props.voiceRecordStyles}
                trans={this.props.trans.inputToolbar}
            />
        );
    }

    renderAddFiles() {
        if (this.props.renderAddFiles) {
            return this.props.renderAddFiles(this.selectFile.bind(this));
        }

        return (
            <TouchableOpacity style={[styles.containerAddFiles, this.getPropsStyle('containerAddFiles')]} onPress={() => this.openActions(true)} {...Utils.testProps('btnAddFiles')}>
                <Image source={this.props.icons.actionAddFiles || require('../assets/icon-add-files.png')} style={[styles.iconActionsAddFiles, this.getPropsStyle('iconActionsAddFiles')]} />
            </TouchableOpacity>
        );
    }

    renderInput() {
        if (this.props.renderInput) {
            return this.props.renderInput(this.onChangeText, this.onContentSizeChange);
        }

        return (
            <View style={[styles.containerTextInput, this.getPropsStyle('containerTextInput')]}>
                <TextInput
                    testID={this.props.inputTestId}
                    accessible
                    accessibilityLabel={this.props.inputTestId}
                    placeholder={this.props.trans.inputToolbar.placeholder}
                    placeholderTextColor={this.props.placeholderTextColor}
                    multiline
                    onChange={this.onContentSizeChange}
                    onContentSizeChange={this.onContentSizeChange}
                    onChangeText={this.onChangeText}
                    style={[styles.textInput, this.getPropsStyle('textInput'), { height: this.props.composerHeight }]}
                    autoFocus={false}
                    value={this.state.text}
                    enablesReturnKeyAutomatically
                    underlineColorAndroid="transparent"
                    {...this.props.textInputProps}
                    {...Utils.testProps('inputText')}
                />
                <TouchableOpacity style={[styles.containerAddSmiles, this.getPropsStyle('containerAddSmiles')]} onPress={() => this.showEmojis(true)} {...Utils.testProps('btnSmileOpen')}>
                    <Image source={this.props.icons.actionsAddSmiles || require('../assets/icon-smile.png')} style={[styles.iconActionsAddSmiles, this.getPropsStyle('iconActionsAddSmiles')]} />
                </TouchableOpacity>
            </View>
        );
    }

    renderSend() {
        if (this.props.renderSend) {
            return this.props.renderSend(this.state.text, this.addAudio, this.addImage, this.send);
        }

        if (!this.state.text) {
            return (
                <View style={[styles.containerAddActions, this.getPropsStyle('containerAddActions')]}>
                    <TouchableOpacity style={[styles.containerAddAudio, this.getPropsStyle('containerAddAudio')]} onPress={() => this.startRecording()} {...Utils.testProps('btnAddAudio')}>
                        <Image source={this.props.icons.actionsAddAudio || require('../assets/icon-add-audio.png')} style={[styles.iconActionsAddAudio, this.getPropsStyle('iconActionsAddAudio')]} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.containerAddImage, this.getPropsStyle('containerAddImage')]} onPress={() => this.openGallery()} {...Utils.testProps('btnAddFileImage')}>
                        <Image source={this.props.icons.actionsAddImage || require('../assets/icon-add-image.png')} style={[styles.iconActionsAddImage, this.getPropsStyle('iconActionsAddImage')]} />
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <TouchableOpacity style={[styles.containerSend, this.getPropsStyle('containerSend')]} onPress={() => this.addText()} {...Utils.testProps('btnSend')}>
                <Image source={this.props.icons.actionsSend || require('../assets/icon-send.png')} style={[styles.iconActionsSend, this.getPropsStyle('iconActionsSend')]} />
            </TouchableOpacity>
        );
    }

    renderEmojis() {
        if (this.props.renderEmojis) {
            return this.props.renderEmojis(this.state.showEmojis, this.showEmojis, this.addSmiles);
        }

        return (
            <Modal animationType="fade" transparent visible={this.state.showEmojis} onRequestClose={() => this.showEmojis(false)}>
                <TouchableWithoutFeedback style={[styles.containerTouchEmojis, this.getPropsStyle('containerTouchEmojis')]} onPress={() => this.showEmojis(false)} {...Utils.testProps('btnSmileClose')}>
                    <View style={[styles.containerTouchEmojisInner, this.getPropsStyle('containerTouchEmojisInner')]}>
                        <View style={[styles.containerEmojis, this.getPropsStyle('containerEmojis')]}>
                            <EmojiSelector columns={10} showSectionTitles={false} showSearchBar={false} onEmojiSelected={emoji => this.addSmiles(emoji)} />
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        );
    }

    render() {
        const { showRecordAudio } = this.state;
        if (this.props.render) {
            return this.props.render(showRecordAudio);
        }

        if (showRecordAudio) {
            return (
                <View style={[styles.container, this.getPropsStyle('container'), { height: this.props.inputbarHeight }]}>
                    {this.renderRecordAudio()}
                </View>
            );
        }

        return (
            <View style={[styles.container, this.getPropsStyle('container'), { height: this.props.inputbarHeight }]}>
                {this.renderAddFiles()}
                {this.renderInput()}
                {this.renderSend()}
                {this.renderEmojis()}
            </View>
        );
    }
}
InputToolbar.defaultProps = {
    trans: { inputToolbar: trans.t('inputToolbar'), fileModule: trans.t('fileModule') },
    inputbarHeight: 44,
    composerHeight: Platform.select({ ios: 33, android: 41 }),
    inputTestId: '',
    placeholderTextColor: Colors.greyDark,
    inputToolbarStyles: {},
    textInputProps: {},
    render: null,
    renderAddFiles: null,
    renderInput: null,
    renderSend: null,
    renderRecordAudio: null,
    renderEmojis: null,
    renderQuote: null,
    onInputTextChanged: () => { },
    onInputSizeChanged: () => { },
    iconActionsAddFiles: null,
    iconActionsAddSmiles: null,
    iconActionsAddAudio: null,
    iconActionsAddImage: null,
    iconActionsSend: null,
    keyboardListeners: null,
    setLoading: () => { },
    sendMessage: { text: () => {}, file: () => {} },
    voiceRecordStyles: null,
    resizeX: 1000,
    resizeY: 1600,
    imageQuality: 80,
    members: {},
    messageSent: () => {},
    showInputbarActions: null,
    icons: {},
};
InputToolbar.propTypes = {
    trans: PropTypes.object,
    inputbarHeight: PropTypes.number,
    composerHeight: PropTypes.number,
    inputTestId: PropTypes.string,
    placeholderTextColor: PropTypes.string,
    inputToolbarStyles: PropTypes.object,
    textInputProps: PropTypes.object,
    render: PropTypes.func,
    renderAddFiles: PropTypes.func,
    renderInput: PropTypes.func,
    renderSend: PropTypes.func,
    renderRecordAudio: PropTypes.func,
    renderEmojis: PropTypes.func,
    renderQuote: PropTypes.func,
    onInputTextChanged: PropTypes.func,
    onInputSizeChanged: PropTypes.func,
    iconActionsAddFiles: PropTypes.object,
    iconActionsAddSmiles: PropTypes.object,
    iconActionsAddAudio: PropTypes.object,
    iconActionsAddImage: PropTypes.object,
    iconActionsSend: PropTypes.object,
    keyboardListeners: PropTypes.object,
    setLoading: PropTypes.func,
    sendMessage: PropTypes.object,
    voiceRecordStyles: PropTypes.object,
    resizeX: PropTypes.number,
    resizeY: PropTypes.number,
    imageQuality: PropTypes.number,
    members: PropTypes.object,
    messageSent: PropTypes.func,
    showInputbarActions: PropTypes.func,
    icons: PropTypes.object,
};

export default InputToolbar;
