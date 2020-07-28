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

const stylesObj = {
    contentTextContainer: { padding: 10, paddingBottom: 0 },
    contentTextMy: { color: Colors.white, fontSize: 14 },
    contentTextNotMy: { color: Colors.black, fontSize: 14 },
    contentTextQuoteNotMyContainer: { borderLeftWidth: 2, borderColor: Colors.black, paddingLeft: 5, marginBottom: 10 },
    contentTextQuoteMyContainer: { borderLeftWidth: 2, borderColor: Colors.white, paddingLeft: 5, marginBottom: 10 },
    contentTextQuoteNotMy: { fontSize: 12, color: Colors.black, textAlign: 'left' },
    contentTextQuoteMy: { fontSize: 12, color: Colors.white, textAlign: 'left' },
};

class ContentText extends PureComponent {
    render() {
        const { isOwn, contentObj, contentTextStyles } = this.props;

        const styles = { ...stylesObj, ...contentTextStyles };

        if (contentObj.isQuote) {
            const textObj = contentObj.quoteMessageObj;
            return (
                <View style={styles.contentTextContainer}>
                    <View style={isOwn ? styles.contentTextQuoteMyContainer : styles.contentTextQuoteNotMyContainer}>
                        <Text style={isOwn ? styles.contentTextQuoteMy : styles.contentTextQuoteNotMy}>{textObj.quote}</Text>
                    </View>
                    <Text style={isOwn ? styles.contentTextMy : styles.contentTextNotMy}>{textObj.message}</Text>
                </View>
            );
        }

        return <View style={styles.contentTextContainer}><Text style={isOwn ? styles.contentTextMy : styles.contentTextNotMy}>{contentObj.message}</Text></View>;
    }
}

ContentText.defaultProps = {
    contentTextStyles: {},
    contentObj: new ContentTextModel(),
    isOwn: false,
};
ContentText.propTypes = {
    contentTextStyles: PropTypes.object,
    contentObj: PropTypes.object,
    isOwn: PropTypes.bool,
};

export default ContentText;
