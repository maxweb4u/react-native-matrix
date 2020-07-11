import handling from '../handling';

const ProfileApi = {
    updateDisplayName: async (userId, displayname) => {
        const res = await handling.request('put', `/profile/${userId}/displayname`, { displayname });
        return res;
    },
};

export default ProfileApi;
