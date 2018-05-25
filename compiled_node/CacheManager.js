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
function makeCachingDecisionsV0(user, predictions) {
    // UserLogs to use for network availability checking
    let wifiAvailabilityLogs = user.logs.filtered('networkStatus == "WiFi"');
    // AppUsageLogs to predict the number of videos needed to be pushed and the
    // time of pushing (only care about logs where the user watched any videos)
    let appUsageLogs = user.appUsageLogs.filtered("watchedVideosCount > 0");
    // Take the weighted average of the daily UserLogs
    let initialValue = {};
    // Group the UserLogs by day - key is the start of the day as an ISO Date string, value is an array of UserLogs made on that day
    let dailyWifiAvailabilityLogs = wifiAvailabilityLogs.reduce((accumulator, currentValue) => {
        const startOfDayString = moment(currentValue.timeStamp).startOf('day').toISOString();
        accumulator[startOfDayString].push(currentValue);
        return accumulator;
    }, initialValue);
    // Further group the logs - only keep a single UserLog in every `userLogRequestInterval` milliseconds (preferably the one that has "wifi" value)
    // predictions is an array in the form
    // [["label1",bestPredictedRating],...,["labelN",worstPredictedRating]], so
    // predictions[0][0] is the label (videoID) of the best recommendation
    // predictions only contains videos that have not been rated by the user yet,
    // so no need to worry about filtering them, also client-side check is
    // already implemented to prevent downloading an already cached video
    const bestPredictedLabel = predictions[0][0];
    if (typeof bestPredictedLabel === "string") {
        // Need to time this function call
        pushVideoToDevice(bestPredictedLabel, user.userID);
    }
    else {
        log_1.logger.error("predictions[0][0]=" + bestPredictedLabel + " is not a string");
    }
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
    console.log("Existing ratings:");
    console.log(ratingsMatrix);
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
        /*
        // Calculate the hitrate of each AppUsageLog as the ratio of cached videos being watched and all cached videos
        let hitratePerLog = cacheEvents.map(event=>{
            return (event.watchedCachedVideosCount!)/(event.watchedCachedVideosCount!+event.notWatchedCachedVideosCount!);
        });
        // Get the average
        let overallHitrate = hitratePerLog.reduce((currentSum,currentValue)=>{return currentSum+currentValue},0)/hitratePerLog.length;
        return overallHitrate;
        */
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