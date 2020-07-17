/**
 * Created by Max Gor on 6/20/20
 *
 * This is component to show m.text message
 */

import React, { PureComponent } from 'react';
import { Text, Image, TouchableOpacity } from 'react-native';
import PropTypes from 'prop-types';
import Colors from '../lib/colors';

const stylesObj = {
    icon24: { width: 24, height: 24 },
    filePreview: { margin: 10, marginBottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, backgroundColor: Colors.greyLight, padding: 10 },
    textFileTitle: { fontSize: 12, color: Colors.black, paddingLeft: 10 },
    filePreviewMy: { backgroundColor: Colors.white03 },
    textFileTitleMy: { color: Colors.white, paddingLeft: 0 },
};

class ContentFile extends PureComponent {
    onPress = () => {
        if (this.props.onFilePress) {
            this.props.onFilePress(this.props.contentObj);
        }
    }

    render() {
        const { isOwn, contentObj, contentFileStyles } = this.props;
        let image = null;
        const styles = { ...stylesObj, ...contentFileStyles };

        if (contentObj.info.mimetype === 'application/pdf') {
            image = (<Image source={require('../assets/icon-file-pdf.png')} style={styles.icon24} />);
        }

        return (
            <TouchableOpacity style={[styles.filePreview, isOwn && styles.filePreviewMy]} onPress={() => this.onPress()}>
                {image}
                <Text style={[styles.textFileTitle, isOwn && styles.textFileTitleMy]}>{contentObj.title}</Text>
            </TouchableOpacity>
        );
    }
}

ContentFile.defaultProps = {
    contentFileStyles: {},
    contentObj: null,
    isOwn: false,
    onFilePress: null,
};
ContentFile.propTypes = {
    contentFileStyles: PropTypes.object,
    contentObj: PropTypes.object,
    isOwn: PropTypes.bool,
    onFilePress: PropTypes.func,
};

export default ContentFile;
