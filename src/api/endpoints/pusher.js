import handling from '../handling';

const PusherApi = {
    setPusher: async (params) => {
        const res = await handling.request('post', '/pushers/set', params);
        return res;
    },
};

export default PusherApi;
