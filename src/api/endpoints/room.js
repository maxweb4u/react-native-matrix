import handling from '../handling';

const RoomApi = {
    create: async (data) => {
        const res = await handling.request('post', '/createRoom', data);
        return res;
    },

    acceptInvite: async (roomId) => {
        const res = await handling.request('post', `/rooms/${roomId}/join`);
        return res;
    },

    leave: async (roomId) => {
        const res = await handling.request('post', `/rooms/${roomId}/leave`);
        return res;
    },

    edit: async (data) => {
        const res = await handling.request('post', '/createRoom', data);
        return res;
    },

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

    setRoomReadMarkers: async (roomId, eventId) => {
        const data = {
            'm.fully_read': eventId,
            'm.read': eventId,
        };
        const res = await handling.request('post', `/rooms/${roomId}/read_markers`, data);
        return res;
    },

    sendStateEvent: async (roomId, type, content) => {
        const res = await handling.request('put', `/rooms/${roomId}/state/${type}`, content);
        return res;
    },
};

export default RoomApi;
