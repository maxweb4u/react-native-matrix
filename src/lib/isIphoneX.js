/**
 * Created by Max Gor on 6/20/20
 *
 * Determine iphoneX or not
 */


import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

export default function isIphoneX() {
    const iphoneXIds = ['iPhone11,2', 'iPhone10,3', 'iPhone10,6', 'iPhone11,4', 'iPhone11,6', 'iPhone11,8', 'iPhone12,1', 'iPhone12,3', 'iPhone12,5'];
    const deviceId = DeviceInfo.getDeviceId();
    return Platform.OS === 'ios' && iphoneXIds.includes(deviceId);
}
