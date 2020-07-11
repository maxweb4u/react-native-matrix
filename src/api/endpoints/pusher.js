import handling from '../handling';

const SecureApi = {
    sync: async (fullState, since, filter, presence, timeout) => {
        fullState = fullState || false;
        const params = { full_state: fullState };
        if (since) {
            params.since = since;
        }
        if (filter) {
            params.filter = filter;
        }
        if (presence) {
            params.presence = presence;
        }
        if (timeout) {
            params.timeout = timeout;
        }
        const res = await handling.request('get', '/sync', null, params);
        return res;
    },

    setPusher: async (params) => {
        const res = await handling.request('post', '/pushers/set', params);
        return res;
    },
};

export default SecureApi;
