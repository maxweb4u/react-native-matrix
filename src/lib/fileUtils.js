import { Platform } from 'react-native';
import ImagePicker from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';
import ImageResizer from 'react-native-image-resizer';
import ImgToBase64 from 'react-native-image-base64';
import RNFetchBlob from 'rn-fetch-blob';
import trans from '../trans';

const FileUtils = {
    resizeImage: (response, callback, resizeX, resizeY, quality) => {
        if (response.uri) {
            resizeY = response.height * (resizeX / response.width);
            ImageResizer.createResizedImage(response.uri, resizeX, resizeY, 'JPEG', quality)
                .then((res) => {
                    const obj = { uri: res.uri, filename: res.name, type: 'image/jpeg', size: res.size };
                    FileUtils.getBase64String(res.uri).then((base64String) => {
                        obj.base64 = base64String;
                        callback(null, obj);
                    }).catch(err => callback(err.msg, null));
                })
                .catch(err => callback(err.msg, null));
        } else {
            callback('noURI', null);
        }
    },

    getFileFromCamera: (callback, setLoadingState, resizeX, resizeY, quality) => {
        ImagePicker.launchCamera({ mediaType: 'photo', storageOptions: { skipBackup: true, path: 'files' } }, (response) => {
            if (response.didCancel) {
                setLoadingState(false);
            } else if (response.error) {
                callback(response.error, null);
            } else {
                FileUtils.resizeImage(response, callback, resizeX, resizeY, quality);
            }
        });
    },

    getFileFromGallery: (callback, setLoadingState, resizeX, resizeY, quality, transObj) => {
        const options = {
            title: transObj.textSelectDocument,
            cancelButtonTitle: transObj.textCancelButtonTitle,
            takePhotoButtonTitle: transObj.textTakePhotoButtonTitle,
            chooseFromLibraryButtonTitle: transObj.textChooseFromLibraryButtonTitle,
            mediaType: 'photo',
            storageOptions: {
                skipBackup: true,
                path: 'files',
            },
        };
        ImagePicker.launchImageLibrary(options, (response) => {
            if (response.didCancel) {
                setLoadingState(false);
            } else if (response.error) {
                callback(response.error, null);
            } else {
                FileUtils.resizeImage(response, callback, resizeX, resizeY, quality);
            }
        });
    },

    getPDFFile: (callback, setLoadingState) => {
        setLoadingState(false);
        DocumentPicker.pick({ type: [DocumentPicker.types.pdf] }).then((res) => {
            const obj = { uri: res.uri, filename: res.name, type: res.type, size: res.size };
            FileUtils.getBase64String(res.uri).then((base64String) => {
                obj.base64 = base64String;
                callback(null, obj);
            }).catch(err => callback(err.msg, null));
        }).catch((error) => {
            callback(error, null);
        });
    },

    uploadFile: ({ callback, setLoadingState, resizeX, resizeY, quality, returnBase64, transObj, showUploadPDF }) => {
        if (!transObj) {
            transObj = trans.t('fileModule');
        }
        resizeX = resizeX || 500;
        resizeY = resizeY || 500;
        quality = quality || 80;
        if (!setLoadingState) {
            setLoadingState = () => {};
        }

        const options = {
            title: transObj.textSelectDocument,
            cancelButtonTitle: transObj.textCancelButtonTitle,
            takePhotoButtonTitle: transObj.textTakePhotoButtonTitle,
            chooseFromLibraryButtonTitle: transObj.textChooseFromLibraryButtonTitle,
            mediaType: 'photo',
            storageOptions: {
                skipBackup: true,
                path: 'files',
            },
        };
        if (showUploadPDF) {
            options.customButtons = [{ name: 'pdffile', title: transObj.textUploadPDF }];
        }
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
