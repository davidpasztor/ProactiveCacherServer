// Import modules
import { URL } from "url";
import ytDownloader = require('./ytDownloader');
import http = require('http');
import express = require('express');
import path = require('path');
import bodyParser = require('body-parser');
import Realm = require('realm');
import realmHandler = require('./RealmHandler');
import fs = require('fs');
import cacheManager = require('./CacheManager');
import {logger} from "./log";
import YouTubeBrowser = require('./YouTubeBrowser');
import { Rating, User, VideoCategory, Video } from "./RealmHandler";
import { youtube_v3 } from "googleapis";
import { Results } from "realm";

// Create Express app and set its port to 3000 by default
var app = express();
app.set('port',process.env.PORT || 3000);

// For JSON parsing
app.use(bodyParser.json({limit:'50mb'}));

// HTTP status codes
const OK = 200;         // Default success response
const CREATED = 201;    // The request succeeded with the creation of a new resource
const ACCEPTED = 202;   // Request is ok, but the server is processing, so can't return the data immediately (such as for uploadVideo)
const BAD_REQ = 400;    // Request is malformed - bad syntax, missing parameters
const UNAUTH = 401;     // Unauthorized - no or incorrect auth header
const INT_ERROR = 500;  // Internal server error

// Autoupdating Results instance storing all Users
export let users: Results<User>;
// Do stuff that needs to happen once, at the start of the server
function executeStartupTasks(){
    let youTubeCategories:youtube_v3.Schema$VideoCategory[];
    let videoCategories:Results<VideoCategory>;
    let videos:Results<Video>;
    let uncategorizedVideos:Results<Video>;
    let realm:Realm;
    logger.info("Startup tasks executing");
    return realmHandler.performMigration().then( openRealm => {
        realm = openRealm;
        return realmHandler.getUsers();
    }).then(fetchedUsers => {
        users = fetchedUsers;
        // Repeat the push notification at the set interval
          setInterval( () => {
                // Send a push notification to all users to generate a new UserLog
                cacheManager.sendNetwAvailReqPushToAll(users!);
          },cacheManager.userLogRequestInterval);
        // Get YouTube categories from the API and the already saved ones from Realm
        return YouTubeBrowser.videoCategories;
    }).then(fetchedYouTubeCategories=>{
        videoCategories = realm.objects<VideoCategory>(VideoCategory.schema.name);
        youTubeCategories = fetchedYouTubeCategories;
        // Filter the fetched categories from YouTube to only keep the ones that haven't already been added to Realm
        const newYouTubeCategories = youTubeCategories.filter(ytCat=>videoCategories.filtered("id == $0",ytCat.id).length == 0);
        logger.info("Found "+newYouTubeCategories.length+" new YouTube video categories, saving them to Realm");
        // Add the new YouTube categories to Realm and retrieve the existing videos
        return realmHandler.addVideoCategories(newYouTubeCategories);
    }).then(()=>{
        videos = realm.objects<Video>(Video.schema.name);
        uncategorizedVideos = videos.filtered("category == null");
        logger.info("Found "+uncategorizedVideos.length+" videos with no category");
        // Fetch the category for each Video that doesn't have one yet
        return Promise.all(uncategorizedVideos.map(video=>YouTubeBrowser.videoDetails(video.youtubeID)));
    }).then(snippets=>{
        // Iterating through the Results (uncategorizedVideos) would fuck up matching indexes with snippets, since when a category is added to a video, the Results instance is updated, so need a non-updating Array to iterate through
        const uncategorizedVideosArray = Array.from(uncategorizedVideos);
        return new Promise((resolve,reject)=>{
            try {
                realm.write(()=>{
                    for (let i=0;i<uncategorizedVideosArray.length;i++){
                        logger.debug("Adding category to "+uncategorizedVideosArray[i].title);
                        const categoryId = snippets[i].categoryId;
                        if (categoryId){
                            const youTubeCategory = realm.objectForPrimaryKey<VideoCategory>(VideoCategory.schema.name,categoryId);
                            //youTubeCategory must exist, since all new caterogies were already saved to Realm previously
                            uncategorizedVideosArray[i].category = youTubeCategory!;
                        } else {
                            logger.warn("No categoryId returned from videoDetails for video "+uncategorizedVideosArray[i].youtubeID);
                        }
                    }
                    resolve();
                });
            } catch (error) {
                reject(error);
            }
        });
    });
}

// Middleware for handling authentication
app.use((req,res,next) => {
    // No authentication required during registration
    if (req.path == "/register") {
        return next();
    }
    // Only password required, no userID needed for downloading server files
    if (req.path == "/realm" || req.path.startsWith("/serverlogs")){
        let pw = req.query.password;
        if (!pw || pw != "szezamTarulj"){
            logger.warn("Trying to access the"+req.path+"endpoint without the correct password, password query parameter is: "+pw);
            return res.status(UNAUTH).json({"error":"You don't have access to the "+req.path+"file!"});
        }
        return next();
    }
    // All other client requests require a valid userID
    let userID = req.path == "/stream" ? req.query.user : req.headers.user;
    let user = authenticatedUser(userID);
    if (!userID || !user){
        logger.warn("Unauthenticated user request to "+req.url+" with userID "+userID);
        return res.status(UNAUTH).json({"error":"Invalid userID"});
    }
    // Pass the user object to the next route
    res.locals.user = user;
    next();
});

// Return the User with the corresponding username or undefined if there's no such user
function authenticatedUser(userID:string):User | undefined{
    return users.filtered('userID == $0',userID)[0];
}

// Register new userID
app.post('/register', function(req,res){
    let userID = req.body.userID;
	logger.info("Registration request for username: "+userID);
    if (!userID){
        res.status(BAD_REQ).json({"error":"No userID in request"});
    } else {
        if (!users.filtered('userID == $0',userID).length){
            realmHandler.createUser(userID).then( ()=> {
				logger.info("Registration successful for "+userID);
                res.status(CREATED).json({"message":"User "+userID+" successfully created"});
            }).catch(error => {
				logger.error("Couldn't register user "+userID+ " due to "+error);
                res.status(INT_ERROR).json({"error":error});
            });
        } else {
			logger.warn("User "+userID+" already registered");
            res.status(BAD_REQ).json({"error":"User is already registered"});
        }
    }
});

// Upload youtube video to server
app.post('/storage', function(req,res){
    let videoUrlString = req.body.url;
    // No URL parameter in request body, send error response
    if (videoUrlString === undefined){
        return res.status(BAD_REQ).json({"error":"No URL in request"});
    } else {
        let videoUrl: URL;
	    try {
	        videoUrl = new URL(videoUrlString);
	    } catch (e) {	// Invalid URL, send error response
		    logger.error(e);
		    return res.status(BAD_REQ).json({"error":"URL "+videoUrlString+" is not valid "+e});
	    }
        let youtubeIDregex:RegExp;
        let matches:RegExpExecArray | null;
        if (videoUrl.host == "www.youtube.com" || videoUrl.host == "youtube.com"){
            youtubeIDregex = /\?v\=(\w+)/;
			matches = youtubeIDregex.exec(videoUrl.search);
        } else if (videoUrl.host == "youtu.be") {
            youtubeIDregex = /\/(\w+)/;
            matches = youtubeIDregex.exec(videoUrl.pathname);
        } else {
            return res.status(BAD_REQ).json({"error":"Non-YouTube URL"});
        }
        if (matches !== null){
            let videoID = matches[1];
            // Check if video is already on the server, only download it
            // if it wasn't added before
            realmHandler.getVideoWithID(videoID).then(video=>{
                if (video === undefined){
                    ytDownloader.uploadVideo(videoUrlString, videoID);
                    logger.info("Download of video "+videoID+" successfully started");
                    res.status(ACCEPTED).json({"success":"Download of " + videoUrl + " started"});
                } else {
                    res.json({"message":"Video is already saved on server"});
                }
            }).catch(error=>{
                logger.error("Couldn't check if video "+videoID+" already exists "+error);
                res.status(INT_ERROR).json({"error":error});
            });
        } else {
            res.status(BAD_REQ).json({"error":"Non-YouTube URL"});
        }
    }
});

// Get a list of available videos
app.get('/videos', function(req,res){
    logger.info("User "+req.headers.user+" registered, retrieving videos");
    realmHandler.getVideos().then(videos=>{
        const videosJSON = JSON.stringify(Array.from(videos),function(key,value){
            if (key == "category"){
                const category = <VideoCategory>value;
                return {'id':category.id,'name':category.name};
            }
            return value;
        });
		    res.send(videosJSON);
    }).catch(error=>{
		    logger.error("Couldn't retrieve videos due to "+error);
		    res.status(INT_ERROR).json({"error":error});
    });
});

// Get thumbnail image for video
app.get('/thumbnail', function(req,res){
	let videoID = req.query.videoID
	// Check that videoID is not undefined or null
	if (videoID !== undefined && videoID){
		logger.info("Thumbnail for video "+videoID+ " requested by "+req.headers.user);
		realmHandler.getVideoWithID(videoID).then(video=>{
			if (video !== undefined && video.thumbnailPath){
				logger.info("Sending thumbnail");
				res.sendFile(video.thumbnailPath);
			} else {
				logger.warn("Video "+videoID+" not found, so can't send thumbnail");
				res.status(BAD_REQ).json({"error":"Invalid videoID"});
			}
		}).catch(error=>{
			logger.error("Can't retrieve thumbnail "+error);
			console.log(error);
			res.status(INT_ERROR).json({"error":error});
		});
	} else {
		res.status(BAD_REQ).json({"error":"No videoID in query"});
	}
});

// Stream video
app.get('/stream',function(req,res){
    // Only for this endpoint userID should be query parameter to allow playing
    // the video in an AVPlayer using only the URL and not a URLRequest
	let videoID = req.query.videoID
	if (videoID !== undefined && videoID){
		realmHandler.getVideoWithID(videoID).then(video=>{
			if (video !== undefined && video.filePath !== null){
				logger.info("User "+req.query.user+" requested video "+videoID);
				// Get size information of video
				fs.stat(video.filePath!, function(err,stats){
					if (err) {
						logger.error("Error retrieving video "+videoID+" "+err);
						res.status(INT_ERROR).send(err);
					} else {
						// Range of video requested
						let range = req.headers.range;
						//console.log("Requested video range: "+range);
						// Send the whole video if no range is specified
						if (!range){
							const head = {
							  'Content-Length': stats.size,
							  'Content-Type': 'video/mp4',
							}
							res.writeHead(200, head)
							logger.info("Sending full video to device");
							fs.createReadStream(video.filePath!).pipe(res)
						} else {
							let positions = (range as string).replace(/bytes=/, '').split('-');
							let start = parseInt(positions[0],10);
							let end = positions[1] ? parseInt(positions[1], 10) : stats.size - 1;
							let chunksize = (end - start) + 1;
							let head = {
								'Content-Range': 'bytes '+start+'-'+end+'/'+stats.size,
								'Accept-Ranges': 'bytes',
								'Content-Length': chunksize,
								'Content-Type': 'video/mp4'
							}
							res.writeHead(206,head);
							let streamPosition = {start:start,end:end};
							let stream = fs.createReadStream(video.filePath!,streamPosition);
							logger.info("Streaming part of video "+videoID);
							stream.on('open',function(){
								stream.pipe(res);
							});
							stream.on('error',function(error){
								logger.error("Error streaming video "+error);
								res.status(INT_ERROR).json({"error":error});
							});
						}
					}
				});
			} else {
				res.status(UNAUTH).json({"error":"Invalid videoID"});
			}
		}).catch(error=>{
			logger.error("Can't retrieve video "+videoID+ " "+error);
			console.log(error);
			res.status(INT_ERROR).json({"error":error});
		});
	} else {
		res.status(BAD_REQ).json({"error":"No videoID in query"});
	}
});

// Rate a video
app.post('/videos/rate', function(req,res){
    let thisUser = <User>res.locals.user;
    const videoID = req.body.videoID;
    const rating = req.body.rating;
    if (!videoID || !rating){
        res.status(BAD_REQ).json({"error":"No videoID "+videoID+" or rating "+rating+" in request body"});
    } else {
        realmHandler.getVideoWithID(videoID).then(video=>{
			if (video !== undefined){
				// Create rating
                realmHandler.rateVideo(thisUser,video,rating).then( ()=>{
					logger.info("Rating saved for video "+videoID+" by user "+thisUser.userID);
                    res.status(CREATED).json({"message":"Rating saved"});
                }).catch(error =>{
					logger.error("Error saving rating for video "+videoID+" by user "+thisUser.userID);
					res.status(INT_ERROR).json({"error":error});
                });
			} else {
				res.status(BAD_REQ).json({"error":"Invalid videoID"});
			}
		}).catch(error=>{
			logger.error("Can't retrieve video "+videoID+ " "+error);
			console.log(error);
			res.status(INT_ERROR).json({"error":error});
		});
    }
});

// Upload userlog
app.post('/userlogs', function(req,res){
    let thisUser = <User>res.locals.user;
    // Parse userlog from request body, then save it to Realm
    let userLogs = req.body;
    // Validate the request body
    realmHandler.addUserLogsForUser(userLogs,thisUser).then( ()=>{
		logger.info("UserLogs saved for user "+thisUser.userID);
        res.status(CREATED).json({"message":"UserLogs saved"});
    }).catch(error=>{
		logger.error("Error saving UserLogs for user "+thisUser.userID+" "+error);
        res.status(INT_ERROR).json({"error":error});
    });
});

// TODO: once a new app usage log is uploaded, should make a caching decision for
// the user who uploaded the log

// Upload app usage logs
app.post('/applogs', function(req,res){
    let thisUser = <User>res.locals.user;
    // Parse app usage logs from request body, then save it to Realm
    let appLogs = req.body;
    if (!appLogs){
        console.log("Empty applogs request");
        return res.status(BAD_REQ).json({"error":"No logs in body"});
    }
    // Save the AppUsageLogs to Realm
    realmHandler.addAppLogsForUser(appLogs, thisUser).then( ()=>{
		logger.info("AppUsageLogs saved for user "+thisUser.userID);
        res.status(CREATED).json({"message":"AppUsageLogs saved"});
    }).catch(error => {
		logger.error("Error saving AppUsageLogs for user"+thisUser.userID+" "+error);
        res.status(INT_ERROR).json({"error":error});
    });
    logger.info("Making a caching decision for user "+thisUser.userID);
	  // Make a caching decision
	  realmHandler.openRealm().then( realm => {
		const videos = realm.objects<Video>(Video.schema.name);
		const ratings = realm.objects<Rating>(Rating.schema.name);
		const predictionsModel = cacheManager.generatePredictedRatings(users,videos,ratings);
		const predictions = predictionsModel.recommendations(thisUser.userID);
		console.log("Predictions: ");
		console.log(predictions);
		// Push content in an hour
		const contentPushingInterval = 3600*1000;	// 1 hour in milliseconds
		const recommendedVideo = realm.objectForPrimaryKey<Video>(Video.schema.name,predictions[0][0]);
		logger.info("Recommended video for user "+thisUser.userID+" is video "+recommendedVideo!.title);
		if (recommendedVideo){
			setTimeout( () => {
				logger.info("Pushing video "+recommendedVideo+" to device "+thisUser.userID);
				console.log("Pushing content to device "+thisUser.userID+ " at " + new Date());
				cacheManager.pushVideoToDevice(recommendedVideo.youtubeID,thisUser.userID);
				try {
					realm.write( () => {
						thisUser.cachedVideos.push(recommendedVideo);
					});
				} catch (e) {
					logger.error("Can't add video "+recommendedVideo.title+" to list of cached videos for user "+thisUser.userID+" due to "+e);
				}
			},contentPushingInterval);
		} else {
			console.log("Recommended video with ID "+predictions[0][0]+" not found in realm");
		}
	}).catch(error => {
		logger.error("Can't open realm to retrieve prediction data "+error);
	});
});

// Get a list of available video categories
app.get('/videos/categories', function(req,res){
    realmHandler.getVideoCategories().then(videoCategories=>{
        // JSON.stringify that's used by bodyparser cannot handle circular dependencies and there's one due to the video linkingObjects
        // videos can can be omitted by supplying an array of variable names to include in the JSON
        const videoCategoriesJSON = JSON.stringify(Array.from(videoCategories),['id','name']);
        res.send(videoCategoriesJSON);
    }).catch(error=>{
        logger.error("Error getting video categories: "+error);
        res.status(INT_ERROR).json({"error":error});
    });
});

// Get all videos in a certain category
app.get('/videos/categories/*',function(req,res){
    const categoryID:string = req.params[0];
    realmHandler.getVideosInCategory(categoryID).then(videosInCategory=>{
        const videosInCategoryJSON = JSON.stringify(Array.from(videosInCategory),function(key,value){
            if (key == "category"){
                return undefined;
            }
            return value;
        });
        res.status(OK).send(videosInCategoryJSON);
    }).catch(error=>{
        logger.error("Error retrieving videos in category "+categoryID+" : "+error);
        res.status(INT_ERROR).json({"error":error});
    });
});

// Download the realm file from the server to inspect the data locally
app.get('/realm', function(req,res){
	logger.verbose("Downloading realm file");
	fs.stat(Realm.defaultPath, function(err,stats){
		if (err) {
			logger.error("Error downloading realm file: "+err);
			res.status(INT_ERROR).send(err);
		} else {
			const head = {
				'Content-Length': stats.size,
			  	'Content-Type': 'application/realm',
				'Content-Disposition': 'attachment; filename=serverData.realm'
			}
			res.writeHead(OK, head)
			fs.createReadStream(Realm.defaultPath).pipe(res)
		}
	});
});

// Download the log file (either error or all logs depending on parameter)
app.get('/serverlogs/*', function(req,res){
	let requestedLog = req.params[0];
	let filename:string;
    if (requestedLog == "error"){
		filename = "server_error.log";
        console.log(filename);
	} else if (requestedLog == "all"){
		filename = "server_all.log";
        console.log(filename);
	} else {
		logger.warn("Trying to access serverlogs at "+req.params);
		return res.status(404).json({"error":"Invalid endpoint"});
	}
	logger.verbose("Downloading log files: "+filename);
	fs.stat(filename, function(err,stats){
		if (err) {
			logger.error("Error downloading error log file: "+err);
			return res.status(INT_ERROR).send(err);
		} else {
			const head = {
				'Content-Length': stats.size,
			  	'Content-Type': 'application/log',
				'Content-Disposition': 'attachment; filename='+filename
			}
			res.writeHead(OK, head)
			fs.createReadStream(filename).pipe(res)
		}
	});
});

// Send 404 for all undefined paths
app.use(function(req,res){
    logger.warn("Request failed to "+req.url+", that endpoint is not defined");
    res.status(404).json({"error":"Invalid endpoint"+req.url});
});

// Start the server
executeStartupTasks().then(()=>{
    app.listen(3000, () => logger.info('Cache manager listening on port 3000!'));
}).catch(error=>logger.error("Error during startup tasks:"+error));

