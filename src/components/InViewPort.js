/**
 * Created by Max Gor on 27/01/20
 *
 * Component that provides triggering when component in showing
 */

import React, { PureComponent } from 'react';
import { View, Dimensions, Platform } from 'react-native';
import PropTypes from 'prop-types';
import { timer } from 'rxjs';

class InViewPort extends PureComponent {
    subscription = null;

    constructor(props) {
        super(props);
        this.state = {
            rectTop: 0,
            rectBottom: 0,
            rectWidth: 0,
        }
    }

    componentDidMount() {
        if (this.props.active) {
            this.startWatching();
        } else {
            this.stopWatching();
        }
    }

    componentWillUnmount() {
        this.stopWatching();
    }

    startWatching() {
        this.subscription = timer(500, this.props.delay).subscribe(() => this.check());
    }

    stopWatching() {
        if (this.subscription && this.subscription.unsubscribe) this.subscription.unsubscribe();
    }

    check() {
        let isVisible = false;
        const dimen = Dimensions.get('window');
        if (Platform.OS === 'ios') {
            this.refs.myview.measure((ox, oy, width, height, pageX, pageY) => {
                this.setState({
                    rectTop: pageY,
                    rectBottom: pageY + height,
                    rectWidth: pageX + width,
                });
            });
            isVisible = (
                this.state.rectBottom !== 0 && this.state.rectBottom >= 0 && this.state.rectTop <= dimen.height
                && this.state.rectWidth > 0 && this.state.rectWidth <= dimen.width
            );
        } else {
            this.refs.myview.measureInWindow((pageX, pageY) => {
                this.setState({
                    rectWidth: pageX,
                    rectTop: pageY,
                });
            });
            isVisible = this.state.rectWidth >= 0 && this.state.rectWidth <= dimen.width && this.state.rectTop >= 0 && this.state.rectTop <= dimen.height;
        }
        // notify the parent when the value changes
        if (this.lastValue !== isVisible) {
            this.lastValue = isVisible;
            this.props.onChange(isVisible);
        }
    }

    render() {
        return (
            <View ref="myview" style={this.props.style} collapsable={false}>
                {this.props.children}
            </View>
        );
    }
}

InViewPort.defaultProps = {
    style: {},
    delay: 1000,
    active: false,
    onChange: () => {},
};
InViewPort.propTypes = {
    onChange: PropTypes.func,
    active: PropTypes.bool,
    delay: PropTypes.number,
    style: PropTypes.object,
};

export default InViewPort;
