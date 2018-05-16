"use strict";
exports.__esModule = true;
// Import modules
var module_1 = require();
var ytDownloader = require("./ytDownloader");
var express = require("express");
var bodyParser = require("body-parser");
var Realm = require("realm");
var realmHandler = require("./RealmHandler");
var fs = require("fs");
var streamViewer = require("./streamViewer");
var cacheManager = require("./CacheManager");
var module_2 = require();
// Create Express app and set its port to 3000 by default
var app = express();
app.set('port', process.env.PORT || 3000);
// For JSON parsing
app.use(bodyParser.json());
// HTTP status codes
var OK = 200;
var CREATED = 201;
var BAD_REQ = 400; // Request is malformed - bad syntax, missing parameters
var UNAUTH = 401; // Unauthorized - no or incorrect auth header
var INT_ERROR = 500; // Internal server error
// Autoupdating Results instance storing all Users
var users = null;
realmHandler.performMigration().then(function () {
    return realmHandler.getUsers();
}).then(function (fetchedUsers) {
    users = fetchedUsers;
    // Repeat the push notification at the set interval
    setInterval(function () {
        // Send a push notification to all users to generate a new UserLog
        cacheManager.sendNetwAvailReqPushToAll(users);
    }, cacheManager.userLogRequestInterval);
})["catch"](function (error) {
    console.log(error);
});
// Register new userID
app.post('/register', function (req, res) {
    var userID = req.body.userID;
    module_2.logger.info("Registration request for username: " + userID);
    if (!userID) {
        res.status(BAD_REQ).json({ "error": "No userID in request" });
    }
    else {
        if (!users.filtered('userID == $0', userID).length) {
            realmHandler.createUser(userID).then(function () {
                module_2.logger.info("Registration successful for " + userID);
                res.status(CREATED).json({ "message": "User " + userID + " successfully created" });
            })["catch"](function (error) {
                console.log("Couldn't create user" + error);
                module_2.logger.error("Couldn't register user " + userID + " due to " + error);
                res.status(INT_ERROR).json({ "error": error });
            });
        }
        else {
            module_2.logger.warn("User " + userID + " already registered");
            res.status(BAD_REQ).json({ "error": "User is already registered" });
        }
    }
});
// Upload youtube video to server
app.post('/storage', function (req, res) {
    var videoUrlString = req.body.url;
    var userID = req.headers.user;
    if (!userID || !users.filtered('userID == $0', userID).length) {
        return res.status(UNAUTH).json({ "error": "Invalid userID" });
    }
    // No URL parameter in request body, send error response
    if (videoUrlString === undefined) {
        res.status(BAD_REQ).json({ "error": "No URL in request" });
    }
    else {
        var videoUrl_1 = null;
        try {
            videoUrl_1 = new module_1.URL(videoUrlString);
        }
        catch (e) {
            console.log(e);
            res.status(BAD_REQ).json({ "error": "URL " + videoUrlString + " is not valid " + e });
        }
        if (videoUrl_1.host == "www.youtube.com" || videoUrl_1.host == "youtube.com") {
            var youtubeIDregex = /\?v\=(\w+)/;
            var matches = youtubeIDregex.exec(videoUrl_1.search);
            if (matches !== null) {
                var videoID_1 = matches[1];
                // Check if video is already on the server, only download it
                // if it wasn't added before
                realmHandler.getVideoWithID(videoID_1).then(function (video) {
                    if (video === undefined) {
                        ytDownloader.uploadVideo(videoUrlString, videoID_1);
                        module_2.logger.info("Download of video " + videoID_1 + " successfully started");
                        res.status(206).json({ "success": "Download of " + videoUrl_1 + " started" });
                    }
                    else {
                        res.json({ "message": "Video is already saved on server" });
                    }
                })["catch"](function (error) {
                    console.log(error);
                    module_2.logger.error("Couldn't check if video " + videoID_1 + " already exists " + error);
                    res.status(INT_ERROR).json({ "error": error });
                });
            }
            else {
                res.status(BAD_REQ).json({ "error": "Non-YouTube URL" });
            }
        }
        else if (videoUrl_1.host == "youtu.be") {
            var youtubeIDregex = /\/(\w+)/;
            var matches = youtubeIDregex.exec(videoUrl_1.pathname);
            // TODO: this part is copied exactly from above, should rewrite function
            if (matches !== null) {
                var videoID_2 = matches[1];
                // Check if video is already on the server, only download it
                // if it wasn't added before
                realmHandler.getVideoWithID(videoID_2).then(function (video) {
                    if (video === undefined) {
                        ytDownloader.uploadVideo(videoUrlString, videoID_2);
                        res.status(202).json({ "success": "Download of " + videoUrl_1 + " started" });
                    }
                    else {
                        res.json({ "message": "Video is already saved on server" });
                    }
                })["catch"](function (error) {
                    console.log(error);
                    module_2.logger.error("Couldn't check if video " + videoID_2 + " already exists " + error);
                    res.status(INT_ERROR).json({ "error": error });
                });
            }
            else {
                res.status(BAD_REQ).json({ "error": "Invalid YouTube URL " + videoUrl_1 });
            }
        }
        else {
            res.status(BAD_REQ).json({ "error": "Non-YouTube URL" });
        }
    }
});
// Get a list of available videos
app.get('/videos', function (req, res) {
    var userID = req.headers.user;
    console.log("There are " + users.length + " users registered");
    console.log(userID + " found " + users.filtered('userID == $0', userID).length + " times");
    if (!userID || !users.filtered('userID == $0', userID).length) {
        return res.status(UNAUTH).json({ "error": "Invalid userID" });
    }
    console.log("User registered, retrieving videos");
    module_2.logger.info("User " + userID + " registered, retrieving videos");
    realmHandler.getVideos().then(function (videos) {
        res.send(Array.from(videos));
    })["catch"](function (error) {
        module_2.logger.error("Couldn't retrieve videos due to " + error);
        console.log(error);
        res.status(INT_ERROR).json({ "error": error });
    });
});
// Get thumbnail image for video
app.get('/thumbnail', function (req, res) {
    var userID = req.headers.user;
    if (!userID || !users.filtered('userID == $0', userID).length) {
        return res.status(UNAUTH).json({ "error": "Invalid userID" });
    }
    var videoID = req.query.videoID;
    // Check that videoID is not undefined or null
    if (videoID !== undefined && videoID) {
        module_2.logger.info("Thumbnail for video " + videoID + " requested by " + userID);
        realmHandler.getVideoWithID(videoID).then(function (video) {
            if (video !== undefined) {
                module_2.logger.info("Sending thumbnail");
                res.sendFile(video.thumbnailPath);
            }
            else {
                module_2.logger.warn("Video " + videoID + " not found, so can't send thumbnail");
                res.status(BAD_REQ).json({ "error": "Invalid videoID" });
            }
        })["catch"](function (error) {
            module_2.logger.error("Can't retrieve thumbnail " + error);
            console.log(error);
            res.status(INT_ERROR).json({ "error": error });
        });
    }
    else {
        res.status(BAD_REQ).json({ "error": "No videoID in query" });
    }
});
// Call this endpoint to get the HTML file for playing the stream
app.get('/startStream', function (req, res) {
    var userID = req.headers.user;
    if (!userID || !users.filtered('userID == $0', userID).length) {
        return res.status(UNAUTH).json({ "error": "Invalid userID" });
    }
    var videoID = req.query.videoID;
    if (!videoID) {
        res.status(BAD_REQ).json({ "error": "No videoID in query" });
    }
    else {
        res.send(streamViewer.createHtmlPlayer(videoID));
    }
});
// Stream video
app.get('/stream', function (req, res) {
    // Only for this endpoint userID should be query parameter to allow playing
    // the video in an AVPlayer using only the URL and not a URLRequest
    var userID = req.query.user;
    if (!userID || !users.filtered('userID == $0', userID).length) {
        return res.status(UNAUTH).json({ "error": "Invalid userID" });
    }
    var videoID = req.query.videoID;
    if (videoID !== undefined && videoID) {
        realmHandler.getVideoWithID(videoID).then(function (video) {
            if (video !== undefined, video.filePath != null) {
                module_2.logger.info("User " + userID + " requested video " + videoID);
                // Get size information of video
                fs.stat(video.filePath, function (err, stats) {
                    if (err) {
                        module_2.logger.error("Error retrieving video " + videoID + " " + error);
                        res.status(INT_ERROR).send(err);
                    }
                    else {
                        // Range of video requested
                        var range = req.headers.range;
                        //console.log("Requested video range: "+range);
                        // Send the whole video if no range is specified
                        if (!range) {
                            var head = {
                                'Content-Length': stats.size,
                                'Content-Type': 'video/mp4'
                            };
                            res.writeHead(200, head);
                            module_2.logger.info("Sending full video to device");
                            fs.createReadStream(video.filePath).pipe(res);
                        }
                        else {
                            var positions = range.replace(/bytes=/, '').split('-');
                            var start = parseInt(positions[0], 10);
                            var end = positions[1] ? parseInt(positions[1], 10) : stats.size - 1;
                            var chunksize = (end - start) + 1;
                            var head = {
                                'Content-Range': 'bytes ' + start + '-' + end + '/' + stats.size,
                                'Accept-Ranges': 'bytes',
                                'Content-Length': chunksize,
                                'Content-Type': 'video/mp4'
                            };
                            res.writeHead(206, head);
                            var streamPosition = { start: start, end: end };
                            var stream_1 = fs.createReadStream(video.filePath, streamPosition);
                            module_2.logger.info("Streaming part of video " + videoID);
                            stream_1.on('open', function () {
                                stream_1.pipe(res);
                            });
                            stream_1.on('error', function (error) {
                                module_2.logger.error("Error streaming video " + error);
                                res.status(INT_ERROR).json({ "error": error });
                            });
                        }
                    }
                });
            }
            else {
                res.status(UNAUTH).json({ "error": "Invalid videoID" });
            }
        })["catch"](function (error) {
            module_2.logger.error("Can't retrieve video " + videoID + " " + error);
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
    var userID = req.headers.user;
    var thisUser = users.filtered('userID == $0', userID);
    if (!userID || !thisUser) {
        return res.status(UNAUTH).json({ "error": "Invalid userID" });
    }
    var videoID = req.body.videoID;
    var rating = req.body.rating;
    if (!videoID || !rating) {
        res.status(BAD_REQ).json({ "error": "No videoID " + videoID + " or rating " + rating + " in request body" });
    }
    else {
        realmHandler.getVideoWithID(videoID).then(function (video) {
            if (video !== undefined) {
                // Create rating
                realmHandler.rateVideo(thisUser[0], video, rating).then(function () {
                    module_2.logger.info("Rating saved for video " + videoID + " by user " + userID);
                    res.status(CREATED).json({ "message": "Rating saved" });
                })["catch"](function (error) {
                    module_2.logger.error("Error saving rating for video " + videoID + " by user " + userID);
                    res.status(INT_ERROR).json({ "error": error });
                });
            }
            else {
                res.status(BAD_REQ).json({ "error": "Invalid videoID" });
            }
        })["catch"](function (error) {
            module_2.logger.error("Can't retrieve video " + videoID + " " + error);
            console.log(error);
            res.status(INT_ERROR).json({ "error": error });
        });
    }
});
// Upload userlog
app.post('/userlogs', function (req, res) {
    var userID = req.headers.user;
    var thisUser = users.filtered('userID == $0', userID);
    if (!userID || !thisUser[0]) {
        return res.status(UNAUTH).json({ "error": "Invalid userID" });
    }
    // Parse userlog from request body, then save it to Realm
    var userLogs = req.body;
    // Validate the request body
    realmHandler.addUserLogsForUser(userLogs, thisUser[0]).then(function () {
        module_2.logger.info("UserLogs saved for user " + userID);
        res.status(CREATED).json({ "message": "UserLogs saved" });
    })["catch"](function (error) {
        module_2.logger.error("Error saving UserLogs for user " + userID + " " + error);
        res.status(INT_ERROR).json({ "error": error });
    });
});
// TODO: once a new app usage log is uploaded, should make a caching decision for
// the user who uploaded the log
// Upload app usage logs
app.post('/applogs', function (req, res) {
    var userID = req.headers.user;
    var thisUser = users.filtered('userID == $0', userID);
    if (!userID || !thisUser[0]) {
        return res.status(UNAUTH).json({ "error": "Invalid userID" });
    }
    thisUser = thisUser[0];
    // Parse app usage logs from request body, then save it to Realm
    var appLogs = req.body;
    if (!appLogs) {
        console.log("Empty applogs request");
        return res.status(BAD_REQ).json({ "error": "No logs in body" });
    }
    // Save the AppUsageLogs to Realm
    realmHandler.addAppLogsForUser(appLogs, thisUser).then(function () {
        module_2.logger.info("AppUsageLogs saved for user " + userID);
        res.status(CREATED).json({ "message": "AppUsageLogs saved" });
    })["catch"](function (error) {
        module_2.logger.error("Error saving AppUsageLogs for user" + userID + " " + error);
        res.status(INT_ERROR).json({ "error": error });
    });
    module_2.logger.info("Making a caching decision for user " + userID);
    // Make a caching decision
    realmHandler.openRealm().then(function (realm) {
        var videos = realm.objects('Video');
        var ratings = realm.objects('Rating');
        var predictionsModel = cacheManager.generatePredictedRatings(users, videos, ratings);
        var predictions = predictionsModel.recommendations(thisUser.userID);
        console.log("Predictions: ");
        console.log(predictions);
        // Push content in an hour
        var contentPushingInterval = 3600 * 1000; // 1 hour in milliseconds
        var recommendedVideo = realm.objectForPrimaryKey('Video', predictions[0][0]);
        module_2.logger.info("Recommended video for user " + userID + " is video " + JSON.stringify(recommendedVideo));
        if (recommendedVideo) {
            setTimeout(function () {
                module_2.logger.info("Pushing video " + recommendedVideo + " to device " + thisUser.userID);
                console.log("Pushing content to device " + thisUser.userID + " at " + new Date());
                cacheManager.pushVideoToDevice(recommendedVideo.youtubeID, thisUser.userID);
                try {
                    realm.write(function () {
                        thisUser.cachedVideos.push(recommendedVideo);
                    });
                }
                catch (e) {
                    console.log(e);
                    module_2.logger.error("Can't add video " + recommendedVideo + " to list of cached videos for user " + thisUser.userID + " due to " + error);
                }
            }, contentPushingInterval);
        }
        else {
            console.log("Recommended video with ID " + predictions[0][0] + " not found in realm");
        }
    })["catch"](function (error) {
        module_2.logger.error("Can't open realm to retrieve prediction data " + error);
        console.log(error);
    });
});
// Download the realm file from the server to inspect the data locally
app.get('/realm', function (req, res) {
    var pw = req.query.password;
    if (!pw || pw != "szezamTarulj") {
        module_2.logger.warn("Trying to access the /realm endpoint without the correct password, password query parameter is: " + pw);
        return res.status(UNAUTH).json({ "error": "You don't have access to the realm file!" });
    }
    module_2.logger.verbose("Downloading realm file");
    fs.stat(Realm.defaultPath, function (err, stats) {
        if (err) {
            module_2.logger.error("Error downloading realm file: " + error);
            res.status(INT_ERROR).send(err);
        }
        else {
            var head = {
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
    var pw = req.query.password;
    if (!pw || pw != "szezamTarulj") {
        module_2.logger.warn("Trying to access the /serverlogs endpoint without the correct password, password query parameter is: " + pw);
        return res.status(UNAUTH).json({ "error": "You don't have access to the logs file!" });
    }
    var requestedLog = req.params[0];
    var filename = null;
    if (requestedLog == "error") {
        filename = "server_error.log";
        console.log(filename);
    }
    else if (requestedLog == "all") {
        filename = "server_all.log";
        console.log(filename);
    }
    else {
        module_2.logger.warn("Trying to access serverlogs at " + req.params);
        return res.status(404).json({ "error": "Invalid endpoint" });
    }
    module_2.logger.verbose("Downloading log files: " + filename);
    fs.stat(filename, function (err, stats) {
        if (err) {
            module_2.logger.error("Error downloading error log file: " + error);
            return res.status(INT_ERROR).send(err);
        }
        else {
            var head = {
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
app.use(function (err, req, res, next) {
    var userID = req.headers.user;
    if (!userID || !users.filtered('userID == $0', userID).length) {
        return res.status(UNAUTH).json({ "error": "Invalid userID for endpoint " + req.url });
    }
    module_2.logger.warn("Request failed to " + req.url);
    console.log('Request failed to ' + req.url);
    res.status(404).json({ "error": "Invalid endpoint" });
});
// Start the server
app.listen(3000, function () { return module_2.logger.info('Cache manager listening on port 3000!'); });
module.exports = {
    users: users
};
