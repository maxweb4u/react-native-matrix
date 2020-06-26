/**
 * Created by Max Gor on 6/20/20
 *
 * This is utils class
 */

import moment from 'moment';

const utils = {
    formatTimestamp: (ts, dateformat) => moment(ts).format(dateformat),
    addDotsToString: str => str.length > 20 ? `${str.substr(0, 20)}...` : str,
}

export default Utils;