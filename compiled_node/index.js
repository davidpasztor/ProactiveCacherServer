"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Import modules
const url_1 = require("url");
const ytDownloader = require("./ytDownloader");
const express = require("express");
const bodyParser = require("body-parser");
const Realm = require("realm");
const realmHandler = require("./RealmHandler");
const fs = require("fs");
const cacheManager = require("./CacheManager");
const log_1 = require("./log");
// Create Express app and set its port to 3000 by default
var app = express();
app.set('port', process.env.PORT || 3000);
// For JSON parsing
app.use(bodyParser.json({ limit: '50mb' }));
// HTTP status codes
const OK = 200;
const CREATED = 201;
const BAD_REQ = 400; // Request is malformed - bad syntax, missing parameters
const UNAUTH = 401; // Unauthorized - no or incorrect auth header
const INT_ERROR = 500; // Internal server error
realmHandler.performMigration().then(() => {
    return realmHandler.getUsers();
}).then(fetchedUsers => {
    exports.users = fetchedUsers;
    // Repeat the push notification at the set interval
    setInterval(() => {
        // Send a push notification to all users to generate a new UserLog
        cacheManager.sendNetwAvailReqPushToAll(exports.users);
    }, cacheManager.userLogRequestInterval);
}).catch(error => {
    console.log(error);
});
// Register new userID
app.post('/register', function (req, res) {
    let userID = req.body.userID;
    log_1.logger.info("Registration request for username: " + userID);
    if (!userID) {
        res.status(BAD_REQ).json({ "error": "No userID in request" });
    }
    else {
        if (!exports.users.filtered('userID == $0', userID).length) {
            realmHandler.createUser(userID).then(() => {
                log_1.logger.info("Registration successful for " + userID);
                res.status(CREATED).json({ "message": "User " + userID + " successfully created" });
            }).catch(error => {
                console.log("Couldn't create user" + error);
                log_1.logger.error("Couldn't register user " + userID + " due to " + error);
                res.status(INT_ERROR).json({ "error": error });
            });
        }
        else {
            log_1.logger.warn("User " + userID + " already registered");
            res.status(BAD_REQ).json({ "error": "User is already registered" });
        }
    }
});
// Upload youtube video to server
app.post('/storage', function (req, res) {
    let videoUrlString = req.body.url;
    let userID = req.headers.user;
    if (!userID || !exports.users.filtered('userID == $0', userID).length) {
        return res.status(UNAUTH).json({ "error": "Invalid userID" });
    }
    // No URL parameter in request body, send error response
    if (videoUrlString === undefined) {
        res.status(BAD_REQ).json({ "error": "No URL in request" });
    }
    else {
        let videoUrl;
        try {
            videoUrl = new url_1.URL(videoUrlString);
        }
        catch (e) {
            console.log(e);
            return res.status(BAD_REQ).json({ "error": "URL " + videoUrlString + " is not valid " + e });
        }
        if (videoUrl.host == "www.youtube.com" || videoUrl.host == "youtube.com") {
            let youtubeIDregex = /\?v\=(\w+)/;
            let matches = youtubeIDregex.exec(videoUrl.search);
            if (matches !== null) {
                let videoID = matches[1];
                // Check if video is already on the server, only download it
                // if it wasn't added before
                realmHandler.getVideoWithID(videoID).then(video => {
                    if (video === undefined) {
                        ytDownloader.uploadVideo(videoUrlString, videoID);
                        log_1.logger.info("Download of video " + videoID + " successfully started");
                        res.status(206).json({ "success": "Download of " + videoUrl + " started" });
                    }
                    else {
                        res.json({ "message": "Video is already saved on server" });
                    }
                }).catch(error => {
                    console.log(error);
                    log_1.logger.error("Couldn't check if video " + videoID + " already exists " + error);
                    res.status(INT_ERROR).json({ "error": error });
                });
            }
            else {
                res.status(BAD_REQ).json({ "error": "Non-YouTube URL" });
            }
        }
        else if (videoUrl.host == "youtu.be") {
            const youtubeIDregex = /\/(\w+)/;
            const matches = youtubeIDregex.exec(videoUrl.pathname);
            // TODO: this part is copied exactly from above, should rewrite function
            if (matches !== null) {
                let videoID = matches[1];
                // Check if video is already on the server, only download it
                // if it wasn't added before
                realmHandler.getVideoWithID(videoID).then(video => {
                    if (video === undefined) {
                        ytDownloader.uploadVideo(videoUrlString, videoID);
                        res.status(202).json({ "success": "Download of " + videoUrl + " started" });
                    }
                    else {
                        res.json({ "message": "Video is already saved on server" });
                    }
                }).catch(error => {
                    console.log(error);
                    log_1.logger.error("Couldn't check if video " + videoID + " already exists " + error);
                    res.status(INT_ERROR).json({ "error": error });
                });
            }
            else {
                res.status(BAD_REQ).json({ "error": "Invalid YouTube URL " + videoUrl });
            }
        }
        else {
            res.status(BAD_REQ).json({ "error": "Non-YouTube URL" });
        }
    }
});
// Get a list of available videos
app.get('/videos', function (req, res) {
    let userID = req.headers.user;
    console.log("There are " + exports.users.length + " users registered");
    console.log(userID + " found " + exports.users.filtered('userID == $0', userID).length + " times");
    if (!userID || !exports.users.filtered('userID == $0', userID).length) {
        return res.status(UNAUTH).json({ "error": "Invalid userID" });
    }
    console.log("User registered, retrieving videos");
    log_1.logger.info("User " + userID + " registered, retrieving videos");
    realmHandler.getVideos().then(videos => {
        res.send(Array.from(videos));
    }).catch(error => {
        log_1.logger.error("Couldn't retrieve videos due to " + error);
        console.log(error);
        res.status(INT_ERROR).json({ "error": error });
    });
});
// Get thumbnail image for video
app.get('/thumbnail', function (req, res) {
    let userID = req.headers.user;
    if (!userID || !exports.users.filtered('userID == $0', userID).length) {
        return res.status(UNAUTH).json({ "error": "Invalid userID" });
    }
    let videoID = req.query.videoID;
    // Check that videoID is not undefined or null
    if (videoID !== undefined && videoID) {
        log_1.logger.info("Thumbnail for video " + videoID + " requested by " + userID);
        realmHandler.getVideoWithID(videoID).then(video => {
            if (video !== undefined && video.thumbnailPath) {
                log_1.logger.info("Sending thumbnail");
                res.sendFile(video.thumbnailPath);
            }
            else {
                log_1.logger.warn("Video " + videoID + " not found, so can't send thumbnail");
                res.status(BAD_REQ).json({ "error": "Invalid videoID" });
            }
        }).catch(error => {
            log_1.logger.error("Can't retrieve thumbnail " + error);
            console.log(error);
            res.status(INT_ERROR).json({ "error": error });
        });
    }
    else {
        res.status(BAD_REQ).json({ "error": "No videoID in query" });
    }
});
// Stream video
app.get('/stream', function (req, res) {
    // Only for this endpoint userID should be query parameter to allow playing
    // the video in an AVPlayer using only the URL and not a URLRequest
    let userID = req.query.user;
    if (!userID || !exports.users.filtered('userID == $0', userID).length) {
        return res.status(UNAUTH).json({ "error": "Invalid userID" });
    }
    let videoID = req.query.videoID;
    if (videoID !== undefined && videoID) {
        realmHandler.getVideoWithID(videoID).then(video => {
            if (video !== undefined && video.filePath !== null) {
                log_1.logger.info("User " + userID + " requested video " + videoID);
                // Get size information of video
                fs.stat(video.filePath, function (err, stats) {
                    if (err) {
                        log_1.logger.error("Error retrieving video " + videoID + " " + err);
                        res.status(INT_ERROR).send(err);
                    }
                    else {
                        // Range of video requested
                        let range = req.headers.range;
                        //console.log("Requested video range: "+range);
                        // Send the whole video if no range is specified
                        if (!range) {
                            const head = {
                                'Content-Length': stats.size,
                                'Content-Type': 'video/mp4',
                            };
                            res.writeHead(200, head);
                            log_1.logger.info("Sending full video to device");
                            fs.createReadStream(video.filePath).pipe(res);
                        }
                        else {
                            let positions = range.replace(/bytes=/, '').split('-');
                            let start = parseInt(positions[0], 10);
                            let end = positions[1] ? parseInt(positions[1], 10) : stats.size - 1;
                            let chunksize = (end - start) + 1;
                            let head = {
                                'Content-Range': 'bytes ' + start + '-' + end + '/' + stats.size,
                                'Accept-Ranges': 'bytes',
                                'Content-Length': chunksize,
                                'Content-Type': 'video/mp4'
                            };
                            res.writeHead(206, head);
                            let streamPosition = { start: start, end: end };
                            let stream = fs.createReadStream(video.filePath, streamPosition);
                            log_1.logger.info("Streaming part of video " + videoID);
                            stream.on('open', function () {
                                stream.pipe(res);
                            });
                            stream.on('error', function (error) {
                                log_1.logger.error("Error streaming video " + error);
                                res.status(INT_ERROR).json({ "error": error });
                            });
                        }
                    }
                });
            }
            else {
                res.status(UNAUTH).json({ "error": "Invalid videoID" });
            }
        }).catch(error => {
            log_1.logger.error("Can't retrieve video " + videoID + " " + error);
            console.log(error);
            res.status(INT_ERROR).json({ "error": error });
        });
    }
    else {
        res.status(BAD_REQ).json({ "error": "No videoID in query" });
    }
});
// Rate a video
app.post('/videos/rate', function (req, res) {
    let userID = req.headers.user;
    let thisUser = exports.users.filtered('userID == $0', userID);
    if (!userID || !thisUser) {
        return res.status(UNAUTH).json({ "error": "Invalid userID" });
    }
    const videoID = req.body.videoID;
    const rating = req.body.rating;
    if (!videoID || !rating) {
        res.status(BAD_REQ).json({ "error": "No videoID " + videoID + " or rating " + rating + " in request body" });
    }
    else {
        realmHandler.getVideoWithID(videoID).then(video => {
            if (video !== undefined) {
                // Create rating
                realmHandler.rateVideo(thisUser[0], video, rating).then(() => {
                    log_1.logger.info("Rating saved for video " + videoID + " by user " + userID);
                    res.status(CREATED).json({ "message": "Rating saved" });
                }).catch(error => {
                    log_1.logger.error("Error saving rating for video " + videoID + " by user " + userID);
                    res.status(INT_ERROR).json({ "error": error });
                });
            }
            else {
                res.status(BAD_REQ).json({ "error": "Invalid videoID" });
            }
        }).catch(error => {
            log_1.logger.error("Can't retrieve video " + videoID + " " + error);
            console.log(error);
            res.status(INT_ERROR).json({ "error": error });
        });
    }
});
// Upload userlog
app.post('/userlogs', function (req, res) {
    let userID = req.headers.user;
    let thisUser = exports.users.filtered('userID == $0', userID);
    if (!userID || !thisUser[0]) {
        return res.status(UNAUTH).json({ "error": "Invalid userID" });
    }
    // Parse userlog from request body, then save it to Realm
    let userLogs = req.body;
    // Validate the request body
    realmHandler.addUserLogsForUser(userLogs, thisUser[0]).then(() => {
        log_1.logger.info("UserLogs saved for user " + userID);
        res.status(CREATED).json({ "message": "UserLogs saved" });
    }).catch(error => {
        log_1.logger.error("Error saving UserLogs for user " + userID + " " + error);
        res.status(INT_ERROR).json({ "error": error });
    });
});
// TODO: once a new app usage log is uploaded, should make a caching decision for
// the user who uploaded the log
// Upload app usage logs
app.post('/applogs', function (req, res) {
    let userID = req.headers.user;
    let matchingUsers = exports.users.filtered('userID == $0', userID);
    if (!userID || !matchingUsers[0]) {
        return res.status(UNAUTH).json({ "error": "Invalid userID" });
    }
    let thisUser = matchingUsers[0];
    // Parse app usage logs from request body, then save it to Realm
    let appLogs = req.body;
    if (!appLogs) {
        console.log("Empty applogs request");
        return res.status(BAD_REQ).json({ "error": "No logs in body" });
    }
    // Save the AppUsageLogs to Realm
    realmHandler.addAppLogsForUser(appLogs, thisUser).then(() => {
        log_1.logger.info("AppUsageLogs saved for user " + userID);
        res.status(CREATED).json({ "message": "AppUsageLogs saved" });
    }).catch(error => {
        log_1.logger.error("Error saving AppUsageLogs for user" + userID + " " + error);
        res.status(INT_ERROR).json({ "error": error });
    });
    log_1.logger.info("Making a caching decision for user " + userID);
    // Make a caching decision
    realmHandler.openRealm().then(realm => {
        const videos = realm.objects(realmHandler.Video.schema.name);
        const ratings = realm.objects(realmHandler.Rating.schema.name);
        const predictionsModel = cacheManager.generatePredictedRatings(exports.users, videos, ratings);
        const predictions = predictionsModel.recommendations(thisUser.userID);
        console.log("Predictions: ");
        console.log(predictions);
        // Push content in an hour
        const contentPushingInterval = 3600 * 1000; // 1 hour in milliseconds
        const recommendedVideo = realm.objectForPrimaryKey(realmHandler.Video.schema.name, predictions[0][0]);
        log_1.logger.info("Recommended video for user " + userID + " is video " + JSON.stringify(recommendedVideo));
        if (recommendedVideo) {
            setTimeout(() => {
                log_1.logger.info("Pushing video " + recommendedVideo + " to device " + thisUser.userID);
                console.log("Pushing content to device " + thisUser.userID + " at " + new Date());
                cacheManager.pushVideoToDevice(recommendedVideo.youtubeID, thisUser.userID);
                try {
                    realm.write(() => {
                        thisUser.cachedVideos.push(recommendedVideo);
                    });
                }
                catch (e) {
                    console.log(e);
                    log_1.logger.error("Can't add video " + recommendedVideo + " to list of cached videos for user " + thisUser.userID + " due to " + e);
                }
            }, contentPushingInterval);
        }
        else {
            console.log("Recommended video with ID " + predictions[0][0] + " not found in realm");
        }
    }).catch(error => {
        log_1.logger.error("Can't open realm to retrieve prediction data " + error);
        console.log(error);
    });
});
// Download the realm file from the server to inspect the data locally
app.get('/realm', function (req, res) {
    let pw = req.query.password;
    if (!pw || pw != "szezamTarulj") {
        log_1.logger.warn("Trying to access the /realm endpoint without the correct password, password query parameter is: " + pw);
        return res.status(UNAUTH).json({ "error": "You don't have access to the realm file!" });
    }
    log_1.logger.verbose("Downloading realm file");
    fs.stat(Realm.defaultPath, function (err, stats) {
        if (err) {
            log_1.logger.error("Error downloading realm file: " + err);
            res.status(INT_ERROR).send(err);
        }
        else {
            const head = {
                'Content-Length': stats.size,
                'Content-Type': 'application/realm',
                'Content-Disposition': 'attachment; filename=serverData.realm'
            };
            res.writeHead(OK, head);
            fs.createReadStream(Realm.defaultPath).pipe(res);
        }
    });
});
// Download the log file (either error or all logs depending on parameter)
app.get('/serverlogs/*', function (req, res) {
    let pw = req.query.password;
    if (!pw || pw != "szezamTarulj") {
        log_1.logger.warn("Trying to access the /serverlogs endpoint without the correct password, password query parameter is: " + pw);
        return res.status(UNAUTH).json({ "error": "You don't have access to the logs file!" });
    }
    let requestedLog = req.params[0];
    let filename;
    if (requestedLog == "error") {
        filename = "server_error.log";
        console.log(filename);
    }
    else if (requestedLog == "all") {
        filename = "server_all.log";
        console.log(filename);
    }
    else {
        log_1.logger.warn("Trying to access serverlogs at " + req.params);
        return res.status(404).json({ "error": "Invalid endpoint" });
    }
    log_1.logger.verbose("Downloading log files: " + filename);
    fs.stat(filename, function (err, stats) {
        if (err) {
            log_1.logger.error("Error downloading error log file: " + err);
            return res.status(INT_ERROR).send(err);
        }
        else {
            const head = {
                'Content-Length': stats.size,
                'Content-Type': 'application/log',
                'Content-Disposition': 'attachment; filename=' + filename
            };
            res.writeHead(OK, head);
            fs.createReadStream(filename).pipe(res);
        }
    });
});
// Send 404 for all undefined paths
app.use(function (req, res) {
    let userID = req.headers.user;
    if (!userID || !exports.users.filtered('userID == $0', userID).length) {
        return res.status(UNAUTH).json({ "error": "Invalid userID for endpoint " + req.url });
    }
    log_1.logger.warn("Request failed to " + req.url);
    console.log('Request failed to ' + req.url);
    res.status(404).json({ "error": "Invalid endpoint" });
});
// Start the server
app.listen(3000, () => log_1.logger.info('Cache manager listening on port 3000!'));
//# sourceMappingURL=index.js.map