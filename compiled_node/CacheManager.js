"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const apn = require("apn");
const path = require("path");
const Recommender = require("likely");
const log_1 = require("./log");
const RealmHandler_1 = require("./RealmHandler");
const moment = require("moment");
const options = {
    token: {
        key: path.join(__dirname, '..', 'APNs', 'AuthKey_BZXD7BPD72.p8'),
        keyId: "BZXD7BPD72",
        teamId: "2A6XVR8XB3"
    },
    production: false
};
var apnProvider = new apn.Provider(options);
// Used for groupping notifications on the device
const bundleId = "com.DavidPasztor.ProactiveCacher";
// Device token of my iPhone X - used for testing
let myDeviceToken = "8dfbc6124ec07f151b5d79c6c7a5273e2f444f696f797c215b293bfedbece29e";
// Device token of my iPad - used for testing
let iPadDeviceToken = "bc1e740eb300df5fc8e74f4d50e5644024f55a5254e95bdd122a9eb6e0dd99ad";
// Send a push notification to request a UserLog object this often
exports.userLogRequestInterval = 15 * 60 * 1000; // 15 minutes in milliseconds
// WiFi connection probability threshold for pushing content
exports.wifiProbabilityThreshold = 0.5;
// Send a push notification to the specified device token to request the
// creation of a UserLog object and hence check network availability
function sendNetworkAvailabilityReqPush(deviceToken) {
    let notification = new apn.Notification();
    notification.expiry = Math.floor(Date.now() / 1000) + 24 * 3600; // will expire in 24 hours from now
    notification.payload = { 'message': 'Network Available' };
    // Silent notification must have contentAvailable set to 1 and must not
    // contain alert, sound or badge keys
    notification.contentAvailable = true; // Make the notification silent
    notification.topic = bundleId;
    // Send the notification
    apnProvider.send(notification, deviceToken).then(result => {
        // Show the result of the send operation:
        log_1.logger.verbose("Network availability request push result: " + JSON.stringify(result));
    }).catch(error => {
        log_1.logger.error("Error sending network availability push request: " + error);
    });
}
exports.sendNetworkAvailabilityReqPush = sendNetworkAvailabilityReqPush;
// Send a push notification to all registered users to request the creation of
// a UserLog object and hence check network availability
function sendNetwAvailReqPushToAll(users) {
    let notification = new apn.Notification();
    notification.expiry = Math.floor(Date.now() / 1000) + 3600; // expires in 1 hour
    notification.payload = { 'message': 'Network Available' };
    notification.contentAvailable = true;
    notification.topic = bundleId;
    //TODO: apnProvider.send can accept a string[] for its second input argument, so no need to iterate through each user, can simply map through them to get the userIDs and send the notification to all of them with a single `send` call
    users.forEach(user => {
        apnProvider.send(notification, user.userID).then(result => {
            log_1.logger.verbose("Network availability req push: " + JSON.stringify(result));
            log_1.logger.verbose("Failed sends: " + result.failed.length);
            for (let fail of result.failed) {
                log_1.logger.warn("Push notification failed to " + fail.device + " with status " + fail.status + " and response " + JSON.stringify(fail.response));
                /*
                if (fail.status == "400"){
                    //Delete user if the deviceToken proved to be wrong
                    logger.info("Deleting user "+user.userID+" due to error 400 - bad device token");
                    deleteUser(user);
                }
                */
            }
        }).catch(error => {
            log_1.logger.error("Error sending network availability push:" + error);
        });
    });
}
exports.sendNetwAvailReqPushToAll = sendNetwAvailReqPushToAll;
function pushVideoToDevice(videoID, deviceToken) {
    let notification = new apn.Notification();
    notification.expiry = Math.floor(Date.now() / 1000) + 3600; // expire in 1 hour
    notification.payload = { 'videoID': videoID };
    notification.contentAvailable = true; // Make the notification silent
    notification.topic = bundleId;
    apnProvider.send(notification, deviceToken).then(result => {
        log_1.logger.info("Content push result " + JSON.stringify(result));
    }).catch(error => {
        log_1.logger.error("Error while pushing content to device: " + error);
    });
}
exports.pushVideoToDevice = pushVideoToDevice;
//pushVideoToDevice("VYOjWnS4cMY",iPadDeviceToken);
/*
// Make a caching decision for the specific user - decide what content to push
// to the device (if any) and when to push it
// This function should be called every time a new AppUsageLog object is uploaded
//
export function makeCachingDecision(user:User){
    // Predict when the user will use the app the next time
    // Fetch the AppUsageLog object from the previous day closest to, but later
    // than the current time and find the last UserLog where the user had wifi
    // connection --> content pushing needs to happen at that point in time

    // Find the recommended movies for the user
    //var model = generatePredictedRatings(users,videos,currentRatings);
    //var recommendations = model.recommendations(user.userID);
}
*/
// Make a caching decision for a specific user - simply predict the next time
// they'll have wifi access and push a random video that they haven't cached yet
function makeCachingDecisionsV0(user, recommendationModel) {
    // UserLogs to use for network availability checking
    let wifiAvailabilityLogs = user.logs;
    // AppUsageLogs to predict the number of videos needed to be pushed and the
    // time of pushing (only care about logs where the user watched any videos)
    let appUsageLogs = user.appUsageLogs.filtered("watchedVideosCount > 0");
    // Create a Date object from 00:00:00 today until 23:59:59 today at `userLogRequestInterval` millisecond intervals
    let startOfToday = moment().startOf('day').toDate();
    let endOfToday = moment(startOfToday).endOf('day').toDate();
    let timeSlots = [];
    for (let time = startOfToday; time < endOfToday; time = new Date(time.getTime() + exports.userLogRequestInterval)) {
        timeSlots.push(time);
    }
    // Group the UserLog objects based on which timeslot of the day they correspond to
    // The outer index will be the same as the index of the corresponding timeslot in `timeSlots`
    let initialValue = []; // Only needed to help the TS compiler infer the type of accumulator
    let groupedWifiAvailabilityLogs = wifiAvailabilityLogs.reduce((accumulator, currentValue) => {
        // Calculate the difference in milliseconds between the first timeSlot (startOf('day')) and timeStamp
        let diff = moment(currentValue.timeStamp).diff(moment(currentValue.timeStamp).startOf('day'));
        // Find which timeslot should contain timeStamp
        let timeSlotIndex = Math.floor(diff / exports.userLogRequestInterval);
        if (accumulator[timeSlotIndex] === undefined) {
            accumulator[timeSlotIndex] = [currentValue];
        }
        else {
            accumulator[timeSlotIndex].push(currentValue);
        }
        return accumulator;
    }, initialValue);
    //Calculate the probability of the user having WiFi connection in a specific timeslot by taking the average of all measurements in that timeslot
    let probabilityOfWifiInTimeslot = groupedWifiAvailabilityLogs.map(logsInTimeslot => {
        return logsInTimeslot.reduce((wifiProbability, thisLog) => {
            if (thisLog.networkStatus == "WiFi") {
                wifiProbability += 1;
            }
            return wifiProbability;
        }, 0) / logsInTimeslot.length;
    });
    // Find the next timeslot from now
    let nextTimeSlotIndex = Math.floor(moment().diff(moment().startOf('day')) / exports.userLogRequestInterval);
    // Find the next timeslot where the probability of WiFi is over the threshold
    let nextWifiTimeslotIndex = probabilityOfWifiInTimeslot.slice(nextTimeSlotIndex).findIndex(wifiProbability => wifiProbability > exports.wifiProbabilityThreshold);
    if (nextWifiTimeslotIndex != -1) {
        // Since findIndex is called on the subarray probabilityOfWifiInTimeslot[nextTimeSlotIndex...], if a suitable timeslot was found, need to offset the index by `nextTimeSlotIndex` to get back the original index
        nextWifiTimeslotIndex += nextTimeSlotIndex;
    }
    else {
        // If there's no suitable timeslot until the end of the day, check if there is the next day until the same time as now
        nextWifiTimeslotIndex = probabilityOfWifiInTimeslot.slice(0, nextTimeSlotIndex - 1).findIndex(wifiProbability => wifiProbability > exports.wifiProbabilityThreshold);
    }
    // If there's no optimal timeslot in the next 24 hours, simply try pushing content in the next slot
    let optimalTimeForCaching = timeSlots[nextWifiTimeslotIndex == -1 ? nextTimeSlotIndex : nextWifiTimeslotIndex];
    // Since timeslots are for today, if the optimal time is after midnight, need to increase optimalTimeForCaching by 1 day
    if (optimalTimeForCaching < moment().toDate()) {
        optimalTimeForCaching.setDate(optimalTimeForCaching.getDate() + 1);
    }
    let millisecondsUntilOptimalTimeForCaching = moment(optimalTimeForCaching).diff(new Date());
    log_1.logger.info("Optimal time for caching for User " + user.userID + " calculated to be " + optimalTimeForCaching + ",content pushing will happen in " + millisecondsUntilOptimalTimeForCaching / 1000 + " seconds");
    // Need to time this function call
    setTimeout(() => {
        // Sort the predictions in descending order based on their predicted ratings
        const recommendations = recommendationModel.recommendations(user.userID).sort(function (a, b) { return b[1] - a[1]; });
        console.log("Predicted ratings for user " + user.userID + ":");
        console.log(recommendations);
        // predictions is an array in the form
        // [["label1",bestPredictedRating],...,["labelN",worstPredictedRating]], so
        // predictions[0][0] is the label (videoID) of the best recommendation
        const bestPredictedLabel = recommendations[0][0];
        // predictions only contains videos that have not been rated by the user yet,
        // so no need to worry about filtering them, also client-side check is
        // already implemented to prevent downloading an already cached video
        pushVideoToDevice(bestPredictedLabel, user.userID);
        log_1.logger.info("Pushing video " + bestPredictedLabel + " to " + user.userID);
    }, millisecondsUntilOptimalTimeForCaching);
}
exports.makeCachingDecisionsV0 = makeCachingDecisionsV0;
// Helper function for creating an n-by-m matrix (2D array)
function createMatrix(n, m) {
    var matrix = new Array(n);
    for (var i = 0; i < n; i++) {
        matrix[i] = new Array(m);
    }
    return matrix;
}
// Generate the predicted ratings for all users
function generatePredictedRatings(users, videos, currentRatings) {
    // Create the rowLabels (userID)
    let rowLabels = users.map(user => user.userID);
    // Create the column labels (videoID)
    let columnLabels = videos.map(video => video.youtubeID);
    // Create the input matrix in the form that rows represent users and columns
    // represent ratings for a specific movie by each user
    var ratingsMatrix = createMatrix(rowLabels.length, columnLabels.length);
    ratingsMatrix.forEach(row => row.fill(0)); // likely needs 0s for the non-rated videos
    currentRatings.forEach(rating => {
        ratingsMatrix[rowLabels.indexOf(rating.user.userID)][columnLabels.indexOf(rating.video.youtubeID)] = rating.score;
    });
    //console.log("Existing ratings:");
    //console.log(ratingsMatrix);
    // Build the model
    const model = Recommender.buildModel(ratingsMatrix, rowLabels, columnLabels);
    return model;
}
exports.generatePredictedRatings = generatePredictedRatings;
// Calculate the hitrate of the cache manager as the ratio of the number of cached videos watched by each user and the total number of cached videos
function hitrateOfCacheManager() {
    return RealmHandler_1.getAllAppLogs().then(appLogs => {
        // Find all AppUsageLogs where a cached video was present on the device
        let cacheEvents = appLogs.filtered('notWatchedCachedVideosCount != null OR watchedCachedVideosCount != null').filtered('notWatchedCachedVideosCount != 0 OR watchedCachedVideosCount != 0');
        let goodCacheDecisions = 0;
        let badCacheDecisions = 0;
        for (let cacheEvent of cacheEvents) {
            goodCacheDecisions += cacheEvent.watchedCachedVideosCount;
            badCacheDecisions += cacheEvent.notWatchedCachedVideosCount;
        }
        return goodCacheDecisions / (goodCacheDecisions + badCacheDecisions);
    });
}
exports.hitrateOfCacheManager = hitrateOfCacheManager;
//# sourceMappingURL=CacheManager.js.map