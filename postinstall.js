const fs = require('fs');

//fix timer bug that is appeared when you install matrix-js-sdk for android
// https://stackoverflow.com/questions/44603362/setting-a-timer-for-a-long-period-of-time-i-e-multiple-minutes
let fileLocation = '../react-native/Libraries/Core/Timers/JSTimers.js';
let targetText = 'MAX_TIMER_DURATION_MS = 60';
let replacementText = 'MAX_TIMER_DURATION_MS = 10000';

let fileContent = fs.readFileSync(fileLocation, 'utf8');
if (fileContent.includes(targetText) && !fileContent.includes(replacementText)) {
    const patchedFileContent = fileContent.replace(targetText, replacementText);
    fs.writeFileSync(fileLocation, patchedFileContent, 'utf8');
}

//fix crash in matrix-js-sdk when internet connection is lost
fileLocation = '../matrix-js-sdk/lib/logger.js';
targetText = 'methodName === "error" ||';
replacementText = '';
fileContent = fs.readFileSync(fileLocation, 'utf8');
if (fileContent.includes(targetText)) {
    const patchedFileContent = fileContent.replace(targetText, replacementText);
    fs.writeFileSync(fileLocation, patchedFileContent, 'utf8');
}