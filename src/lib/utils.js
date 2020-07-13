/**
 * Created by Max Gor on 6/20/20
 *
 * This is utils class
 */

import moment from 'moment';

const utils = {
    formatTimestamp: (ts, dateformat) => moment(ts).format(dateformat),
    addDotsToString: str => (str.length > 20 ? `${str.substr(0, 20)}...` : str),
    isNewDay: (curDate, prevDate) => moment(curDate).diff(moment(prevDate), 'days', true) > 1,
    isTextHaveURL: str => str.indexOf('http:') !== -1 || str.indexOf('https:') !== -1,
    timestamp: isMilliseconds => parseInt(isMilliseconds ? moment().valueOf() : moment().unix(), 10),
    convertMessageToQuoteHTML: (text) => {
        const arr = message.split('\n');
        let ret = '<blockquote><p>';
        let isQuoteFinished = false;
        arr.map((val) => {
            if (val.indexOf('> ') !== -1) {
                ret += `${val.replace('> ', '')}<br/>`;
            } else {
                if (!isQuoteFinished) {
                    isQuoteFinished = true;
                    ret += '</p></blockquote>';
                }
                ret += `<p>${val}</p>`;
            }
        });
        return ret;
    },
    parseMXCURI(mxcURI) {
        if (mxcURI) {
            mxcURI = mxcURI.replace('mxc://', '');
            const arr = mxcURI.split('/');
            if (arr.length > 1) {
                return { serverName: arr[0], mediaId: arr[1] };
            }
        }
        return { serverName: '', mediaId: '' };
    },
    getCountdownTitle: (time) => {
        const minutes = Math.floor(time / 60);
        const seconds = time - minutes * 60;
        const secondTitle = seconds < 10 ? `0${seconds}` : seconds;
        return `${minutes}:${secondTitle}`;
    },
};

export default utils;
