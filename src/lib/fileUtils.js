import { Platform } from 'react-native';
import ImagePicker from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';
import ImageResizer from 'react-native-image-resizer';
import ImgToBase64 from 'react-native-image-base64';
import RNFetchBlob from 'rn-fetch-blob';

const FileUtils = {
    uploadFile: ({ callback, setLoadingState, resizeX, resizeY, quality, returnBase64, trans }) => {
        resizeX = resizeX || 100;
        resizeY = resizeY || 100;
        quality = quality || 80;
        if (!setLoadingState) {
            setLoadingState = () => {};
        }

        const options = {
            title: trans.textSelectDocument,
            cancelButtonTitle: trans.textCancelButtonTitle,
            takePhotoButtonTitle: trans.textTakePhotoButtonTitle,
            chooseFromLibraryButtonTitle: trans.textChooseFromLibraryButtonTitle,
            mediaType: 'photo',
            storageOptions: {
                skipBackup: true,
                path: 'files',
            },
        };
        options.customButtons = [{ name: 'pdffile', title: trans.textUploadPDF }];
        ImagePicker.showImagePicker(options, (response) => {
            if (response.didCancel) {
                setLoadingState(false);
            } else if (response.error) {
                callback(response.error, null);
            } else if (response.customButton) {
                setLoadingState(false);
                DocumentPicker.pick({ type: [DocumentPicker.types.pdf] }).then((res) => {
                    const obj = { uri: res.uri, filename: res.name, type: res.type, size: res.size };
                    if (returnBase64) {
                        FileUtils.getBase64String(res.uri).then((base64String) => {
                            obj.base64 = base64String;
                            callback(null, obj);
                        }).catch(err => callback(err.msg, null));
                    } else {
                        callback(null, obj);
                    }
                }).catch((error) => {
                    callback(error, null);
                });
            } else {
                resizeY = response.height * (resizeX / response.width);
                ImageResizer.createResizedImage(response.uri, resizeX, resizeY, 'JPEG', quality)
                    .then((res) => {
                        const obj = { uri: res.uri, filename: res.name, type: 'image/jpeg', size: res.size };
                        if (returnBase64) {
                            FileUtils.getBase64String(res.uri).then((base64String) => {
                                obj.base64 = base64String;
                                callback(null, obj);
                            }).catch(err => callback(err.msg, null));
                        } else {
                            callback(null, obj);
                        }
                    })
                    .catch(err => callback(err.msg, null));
            }
        });
    },

    formatBytes: (bytes, decimals = 0) => {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        // eslint-disable-next-line
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    },

    formatFileMimeType: (mimetype) => {
        let ret = '';
        switch (mimetype) {
            case 'application/pdf':
                ret = 'PDF';
                break;
            default:
                ret = 'FILE';
        }
        return ret;
    },

    readFile: (filePath, type) => {
        type = type || 'base64';
        return RNFetchBlob.fs.readFile(filePath, type).then(data => data).catch(e => e);
    },

    getFileInfo: filePath => RNFetchBlob.fs.stat(filePath).then(data => data).catch(e => e),

    saveFile: (filename, source, type) => {
        type = type || 'base64';
        const filePath = `${RNFetchBlob.fs.dirs.CacheDir}/${filename}`;
        return RNFetchBlob.fs.writeFile(filePath, source, type).then(() => filePath).catch(() => '');
    },

    getBase64String: (uri) => {
        if (Platform.OS === 'ios') {
            return ImgToBase64.getBase64String(uri).then(data => data).catch(e => e);
        }
        return FileUtils.readFile(uri);
    },
};

export default FileUtils;