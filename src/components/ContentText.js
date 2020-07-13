/**
 * Created by Max Gor on 6/20/20
 *
 * This is component to show m.text message
 */

import React, { PureComponent } from 'react';
import { View, Text } from 'react-native';
import PropTypes from 'prop-types';
import ContentTextModel from '../models/ContentText';
import Colors from '../lib/colors';

class ContentText extends PureComponent {
    render() {
        const { isOwn, contentObj, contentTextMy, contentTextNotMy } = this.props;
        return (
            <View style={this.props.contentTextContainer}><Text style={isOwn ? contentTextMy : contentTextNotMy}>{contentObj.message}</Text></View>
        );
    }
}

ContentText.defaultProps = {
    contentTextContainer: {padding: 10, paddingBottom: 0},
    contentTextMy: { color: Colors.white, fontSize: 14 },
    contentTextNotMy: { color: Colors.black, fontSize: 14 },
    contentObj: new ContentTextModel(),
    isOwn: false,
};
ContentText.propTypes = {
    contentTextContainer: PropTypes.object,
    contentTextMy: PropTypes.object,
    contentTextNotMy: PropTypes.object,
    contentObj: PropTypes.object,
    isOwn: PropTypes.bool,
};

export default ContentText;
