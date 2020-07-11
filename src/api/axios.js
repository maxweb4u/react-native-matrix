import axios from 'axios';

const instance = axios.create();

/* eslint-disable */
instance.interceptors.response.use((response) => {
    // console.log("response ::: ", response)
    return response;
}, function (error) {
    // console.log("error ::: ", error.response)
    return Promise.reject(error.response);
});
/* eslint-enable */

export default instance;
