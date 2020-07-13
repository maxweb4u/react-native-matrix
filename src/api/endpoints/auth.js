import handling from '../handling';

const AuthApi = {
    register: async (data) => {
        const res = await handling.request('post', '/register', data, null, true);
        return res;
    },

    login: async (data) => {
        const res = await handling.request('post', '/login', data, null, true);
        return res;
    },

    setAccessToken: (token) => {
        handling.setAccessToken(token);
    },

    removeAccessToken: () => {
        handling.setAccessToken('');
    },

    setBaseURL: (baseURL) => {
        handling.setBaseURL(baseURL);
    },

    getBaseURL: () => {
        handling.getBaseURL();
    },
};

export default AuthApi;
