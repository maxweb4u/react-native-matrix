/**
 * Created by Max Gor on 6/20/20
 *
 * This is input toolbar component
 */

import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { View, StyleSheet, Keyboard, TouchableOpacity, TextInput, Image, Platform } from 'react-native';
import Colors from '../lib/colors';
// import Matrix from '../Matrix';

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        shadowColor: Colors.shadowColor,
        shadowOffset: { width: 0, height: -5 },
        shadowRadius: 5,
        shadowOpacity: 0.2,
        backgroundColor: Colors.white,
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        paddingTop: 5,
        paddingBottom: 5,
    },
    containerAddActions: {flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start'},
    containerAddFiles: { alignItems: 'center', justifyContent: 'center', width: 40, height: 40 },
    containerAddSmiles: { alignItems: 'center', justifyContent: 'center', width: 40, height: 36 },
    containerAddAudio: { alignItems: 'center', justifyContent: 'center', width: 40, height: 40 },
    containerAddImage: { alignItems: 'center', justifyContent: 'center', width: 40, height: 40 },
    containerSend: { alignItems: 'center', justifyContent: 'center', width: 40, height: 40 },
    iconActionsAddFiles: { width: 24, height: 24 },
    iconActionsAddSmiles: { width: 24, height: 24 },
    iconActionsAddAudio: { width: 24, height: 24 },
    iconActionsAddImage: { width: 24, height: 24 },
    iconActionsSend: { width: 24, height: 24 },
    containerTextInput: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', borderRadius: 25, backgroundColor: Colors.grey, padding: 5 },
    textInput: { flex: 1, marginRight: 10, marginLeft: 10, color: Colors.black },
});

class InputToolbar extends PureComponent {
    constructor(props) {
        super(props);
        this.contentSize = undefined;
        this.state = { position: 'absolute' };
    }

    componentDidMount() {
        this.keyboardWillShowListener = Keyboard.addListener('keyboardWillShow', this.keyboardWillShow);
        this.keyboardWillHideListener = Keyboard.addListener('keyboardWillHide', this.keyboardWillHide);
    }

    componentWillUnmount() {
        if (this.keyboardWillShowListener) {
            this.keyboardWillShowListener.remove();
        }
        if (this.keyboardWillHideListener) {
            this.keyboardWillHideListener.remove();
        }
    }

    keyboardWillShow = () => {
        if (this.state.position !== 'relative') {
            this.setState({ position: 'relative' });
        }
    }

    keyboardWillHide = () => {
        if (this.state.position !== 'absolute') {
            this.setState({ position: 'absolute' });
        }
    }

    getPropsStyle = (style) => {
        if (!Object.prototype.hasOwnProperty.call(this.props.inputToolbarStyles, style)) {
            return this.props.inputToolbarStyles[style];
        }
        return null;
    }

    addFiles = () => {
        // console.log("");
    }

    addAudio = () => {
        // console.log("");
    }

    addImage = () => {
        // console.log("");
    }

    addSmiles = () => {
        // console.log("");
    }

    send = () => {
        // console.log("");
    }

    onContentSizeChange = (e) => {
        const { contentSize } = e.nativeEvent;
        // Support earlier versions of React Native on Android.
        if (!contentSize) {
            return;
        }
        if (!this.contentSize
            || (this.contentSize
            && (this.contentSize.width !== contentSize.width
            || this.contentSize.height !== contentSize.height))) {
            this.contentSize = contentSize;
            this.props.onInputSizeChanged(this.contentSize);
        }
    };

    onChangeText = (text) => {
        this.props.onInputTextChanged(text);
    };

    renderAddFiles() {
        if (this.props.renderAddFiles) {
            return this.props.renderAddFiles(this.addFiles.bind(this));
        }

        return (
            <TouchableOpacity style={[styles.containerAddFiles, this.getPropsStyle('containerAddFiles')]} onPress={() => this.addFiles()}>
                <Image source={this.props.iconActionsAddFiles || require('../assets/icon-add-files.png')} style={[styles.iconActionsAddFiles, this.getPropsStyle('iconActionsAddFiles')]} />
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
                    placeholder={this.props.trans.placeholder}
                    placeholderTextColor={this.props.placeholderTextColor}
                    multiline
                    onChange={this.onContentSizeChange}
                    onContentSizeChange={this.onContentSizeChange}
                    onChangeText={this.onChangeText}
                    style={[styles.textInput, this.getPropsStyle('textInput'), { height: this.props.composerHeight }]}
                    autoFocus={false}
                    value={this.props.text}
                    enablesReturnKeyAutomatically
                    underlineColorAndroid="transparent"
                    {...this.props.textInputProps}
                />
                <TouchableOpacity style={[styles.containerAddSmiles, this.getPropsStyle('containerAddSmiles')]} onPress={() => this.addSmiles()}>
                    <Image source={this.props.iconActionsAddSmiles || require('../assets/icon-smile.png')} style={[styles.iconActionsAddSmiles, this.getPropsStyle('iconActionsAddSmiles')]} />
                </TouchableOpacity>
            </View>
        );
    }

    renderSend() {
        if (this.props.renderSend) {
            return this.props.renderSend(this.props.text, this.addAudio, this.addImage, this.send);
        }

        if (!this.props.text) {
            return (
                <View style={[styles.containerAddActions, this.getPropsStyle('containerAddActions')]}>
                    <TouchableOpacity style={[styles.containerAddAudio, this.getPropsStyle('containerAddAudio')]} onPress={() => this.addAudio()}>
                        <Image source={this.props.iconActionsAddAudio || require('../assets/icon-add-audio.png')} style={[styles.iconActionsAddAudio, this.getPropsStyle('iconActionsAddAudio')]} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.containerAddImage, this.getPropsStyle('containerAddImage')]} onPress={() => this.addImage()}>
                        <Image source={this.props.iconActionsAddImage || require('../assets/icon-add-image.png')} style={[styles.iconActionsAddImage, this.getPropsStyle('iconActionsAddImage')]} />
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <TouchableOpacity style={[styles.containerSend, this.getPropsStyle('containerSend')]} onPress={() => this.send()}>
                <Image source={this.props.iconActionsSend || require('../assets/icon-send.png')} style={[styles.iconActionsSend, this.getPropsStyle('iconActionsSend')]} />
            </TouchableOpacity>
        );
    }

    render() {
        if (this.props.render) {
            return this.props.render(this.state.position);
        }

        return (
            <View style={[styles.container, this.getPropsStyle('container'), { position: this.state.position }]}>
                {this.renderAddFiles()}
                {this.renderInput()}
                {this.renderSend()}
            </View>
        );
    }
}
InputToolbar.defaultProps = {
    trans: {},
    composerHeight: Platform.select({ ios: 33, android: 41 }),
    text: '',
    inputTestId: '',
    placeholderTextColor: Colors.greyDark,
    inputToolbarStyles: {},
    textInputProps: {},
    render: null,
    renderAddFiles: null,
    renderInput: null,
    renderSend: null,
    onInputTextChanged: () => { },
    onInputSizeChanged: () => { },
    iconActionsAddFiles: null,
    iconActionsAddSmiles: null,
    iconActionsAddAudio: null,
    iconActionsAddImage: null,
    iconActionsSend: null,
};
InputToolbar.propTypes = {
    trans: PropTypes.object,
    composerHeight: PropTypes.number,
    text: PropTypes.string,
    inputTestId: PropTypes.string,
    placeholderTextColor: PropTypes.string,
    inputToolbarStyles: PropTypes.object,
    textInputProps: PropTypes.object,
    render: PropTypes.func,
    renderAddFiles: PropTypes.func,
    renderInput: PropTypes.func,
    renderSend: PropTypes.func,
    onInputTextChanged: PropTypes.func,
    onInputSizeChanged: PropTypes.func,
    iconActionsAddFiles: PropTypes.object,
    iconActionsAddSmiles: PropTypes.object,
    iconActionsAddAudio: PropTypes.object,
    iconActionsAddImage: PropTypes.object,
    iconActionsSend: PropTypes.object,
};

export default InputToolbar;
