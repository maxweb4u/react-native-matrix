/**
 * Created by Max Gor on 6/20/20
 *
 * get translations
 */

import en from './en';

class Trans {
    static instance;

    local = 'en';

    static getInstance() {
        if (!Trans.instance) {
            Trans.instance = new Trans();
        }
        return Trans.instance;
    }

    setLocale(local) {
        this.local = local || 'en';
    }

    t(param1, param2) {
        if (!param1) {
            return '';
        }
        let f = null;
        switch (this.local) {
            default:
            case 'en':
                f = en;
        }
        if (!f || !Object.prototype.hasOwnProperty.call(f, param1)) {
            return '';
        }
        if (!param2 || !Object.prototype.hasOwnProperty.call(f[param1], param2)) {
            return f[param1];
        }

        return f[param1][param2];
    }
}

export default Trans.getInstance();
