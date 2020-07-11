import handling from '../handling';

const MediaApi = {
    downloadFile: async (serverName, mediaId) => {
        const res = await handling.requestFile(`/download/${serverName}/${mediaId}`);
        return res;
    },

    uploadFile: async (filename, type, base64) => {
        const res = await handling.uploadFile(`/upload?filename=${filename}`, type, base64);
        return res;
    },
};

export default MediaApi;
