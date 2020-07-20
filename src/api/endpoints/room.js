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

    // joinViaAlias: async (roomAlias) => {
    //     const res = await handling.request('post', `/join/${roomAlias}`);
    //     return res;
    // },
    //
    // invite: async (roomId, userId) => {
    //     const res = await handling.request('post', `/rooms/${roomId}/invite`, { user_id: userId });
    //     return res;
    // },
    //
    // sendMessage: async (roomAlias, data) => {
    //     const res = await handling.request('post', `/rooms/${roomAlias}/send/m.room.message`, data);
    //     return res;
    // },
    //
    // getRoomByAlias: async (roomAlias) => {
    //     const res = await handling.request('get', `/directory/room/${encodeURIComponent(roomAlias)}`);
    //     return res;
    // },
    //
    // getMessages: async (roomId, from, filter, limit, to, dir) => {
    //     limit = limit || 10;
    //     from = from || 'start';
    //     dir = dir || 'b';
    //     const options = { limit, from, dir };
    //     if (to) {
    //         options.to = to;
    //     }
    //     if (filter && Object.keys(filter).length) {
    //         options.filter = filter;
    //     }
    //     const res = await handling.request('get', `/rooms/${encodeURIComponent(roomId)}/messages`, null, options);
    //     return res;
    // },
};

export default RoomApi;
