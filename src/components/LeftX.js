import React, { PureComponent } from 'react';
import { Animated, InteractionManager } from 'react-native';

class LeftX extends PureComponent {
    constructor(props) {
        super(props);

        const { fromValue } = props;

        this.state = {
            leftValue: new Animated.Value(fromValue),
            opacityValue: new Animated.Value(0),
        };
    }

    componentDidMount() {
        const { startOnDidMount } = this.props;

        if (startOnDidMount) {
            InteractionManager.runAfterInteractions().then(() => {
                this.show();
            });
        }
    }

    show(callback) {
        const { leftValue, opacityValue } = this.state;
        const { duration, toValue } = this.props;

        Animated.parallel([
            Animated.timing(opacityValue, {
                toValue: 1,
                duration,
            }),
            Animated.timing(leftValue, {
                toValue,
                duration,
            }),
        ]).start(() => {
            if (callback) {
                callback();
            }
        });
    }

    hide(callback) {
        const { leftValue, opacityValue } = this.state;
        const { duration, fromValue } = this.props;

        Animated.parallel([
            Animated.timing(opacityValue, {
                toValue: 0,
                duration,
            }),
            Animated.timing(leftValue, {
                toValue: fromValue,
                duration,
            }),
        ]).start(() => {
            if (callback) {
                callback();
            }
        });
    }

    render() {
        const { opacityValue, leftValue } = this.state;
        const style = this.props.style || {};

        const animatedStyle = {
            position: 'absolute',
            opacity: opacityValue,
            left: leftValue,
            ...style,
        };

        return (
            <Animated.View style={animatedStyle}>
                {this.props.children}
            </Animated.View>
        );
    }
}

export default LeftX;
