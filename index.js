'use strict';
// Import modules
const {URL} = require('url');
const ytDownloader = require('./ytDownloader');
const http = require('http');
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const Realm = require('realm');
const realmHandler = require('./RealmHandler');
const fs = require('fs');
const streamViewer = require('./streamViewer');

// Create Express app and set its port to 3000 by default
var app = express();
app.set('port',process.env.PORT || 3000);

// For JSON parsing
app.use(bodyParser.json());

// HTTP status codes
const OK = 200;
const CREATED = 201;
const BAD_REQ = 400;    // Request is malformed - bad syntax, missing parameters
const UNAUTH = 401;     // Unauthorized - no or incorrect auth header
const INT_ERROR = 500;  // Internal server error

//app.get('/', (req, res) => res.send('Hello World!'));
//app.get('/storage', (req,res) => res.send('GET request to storage'));

var users = null;
realmHandler.performMigration().then( () => {
    return realmHandler.getUsers();
}).then(fetchedUsers => {
    users = fetchedUsers;
}).catch(error => {
    console.log(error);
});

// Register new userID
app.post('/register', function(req,res){
    let userID = req.body.userID;
    if (!userID){
        res.status(BAD_REQ).json({"error":"No userID in request"});
    } else { 
        if (!users.filtered('userID == $0',userID).length){
            realmHandler.createUser(userID).then( ()=> {
                res.status(CREATED).json({"message":"User "+userID+" successfully created"});
            }).catch(error => {
                console.log("Couldn't create user"+error)
                res.status(INT_ERROR).json({"error":error});
            });
        } else {
            res.status(BAD_REQ).json({"error":"User is already registered"});
        }
    }
});

// Upload youtube video to server
app.post('/storage', function(req,res){
	let videoUrlString = req.body.url;
    let userID = req.headers.user;
    if (!userID || !users.filtered('userID == $0',userID).length){
        return res.status(UNAUTH).json({"error":"Invalid userID"});
    }
	// No URL parameter in request body, send error response
	if (videoUrlString === undefined){
		res.status(BAD_REQ).json({"error":"No URL in request"});
	} else {
		let videoUrl = null;
		try {
			videoUrl = new URL(videoUrlString);	
		} catch (e) {	// Invalid URL, send error response
			console.log(e);
			res.status(BAD_REQ).json({"error":"URL "+videoUrlString+" is not valid "+e});
		}
        if (videoUrl.host == "www.youtube.com" || videoUrl.host == "youtube.com"){
            let youtubeIDregex = /\?v\=(\w+)/;
			let matches = youtubeIDregex.exec(videoUrl.search)
			if (matches  !== null){
				let videoID = matches[1];
				// Check if video is already on the server, only download it
				// if it wasn't added before
				realmHandler.getVideoWithID(videoID).then(video=>{
					if (video === undefined){
						ytDownloader.uploadVideo(videoUrlString, videoID);
						res.status(206).json({"success":"Download of " + videoUrl + " started"});
					} else {
						res.json({"message":"Video is already saved on server"});
					}
				}).catch(error=>{
					console.log(error);
					res.status(INT_ERROR).json({"error":error});
				});
			} else {
				res.status(BAD_REQ).json({"error":"Non-YouTube URL"});
			}
        } else if (videoUrl.host == "youtu.be") {
            const youtubeIDregex = /\/(\w+)/;
            const matches = youtubeIDregex.exec(videoUrl.pathname);
            // TODO: this part is copied exactly from above, should rewrite function
            if (matches !== null){
                let videoID = matches[1];
				// Check if video is already on the server, only download it
				// if it wasn't added before
				realmHandler.getVideoWithID(videoID).then(video=>{
					if (video === undefined){
						ytDownloader.uploadVideo(videoUrlString, videoID);
						res.status(202).json({"success":"Download of " + videoUrl + " started"});
					} else {
						res.json({"message":"Video is already saved on server"});
					}
				}).catch(error=>{
					console.log(error);
					res.status(INT_ERROR).json({"error":error});
				});
            } else {
                res.status(BAD_REQ).json({"error":"Invalid YouTube URL "+videoUrl});
            }
        } else {
			res.status(BAD_REQ).json({"error":"Non-YouTube URL"});
        }	
	}
});

// Get a list of available videos
app.get('/videos', function(req,res){
    let userID = req.headers.user;
    console.log("There are " + users.length + " users registered");
    console.log(userID + " found " + users.filtered('userID == $0',userID).length + " times");
    if (!userID || !users.filtered('userID == $0',userID).length){
        return res.status(UNAUTH).json({"error":"Invalid userID"});
    }
    console.log("User registered, retrieving videos");
	realmHandler.getVideos().then(videos=>{
		res.send(Array.from(videos));
	}).catch(error=>{
		console.log(error);
		res.status(INT_ERROR).json({"error":error});
	});
});

// Get thumbnail image for video
app.get('/thumbnail', function(req,res){
    let userID = req.headers.user;
    if (!userID || !users.filtered('userID == $0',userID).length){
        return res.status(UNAUTH).json({"error":"Invalid userID"});
    }
	let videoID = req.query.videoID
	// Check that videoID is not undefined or null
	if (videoID !== undefined && videoID){
		realmHandler.getVideoWithID(videoID).then(video=>{
			if (video !== undefined){
				res.sendFile(video.thumbnailPath);
			} else {
				res.status(BAD_REQ).json({"error":"Invalid videoID"});
			}
		}).catch(error=>{
			console.log(error);
			res.status(INT_ERROR).json({"error":error});
		});
	} else {
		res.status(BAD_REQ).json({"error":"No videoID in query"});
	}
});

// Call this endpoint to get the HTML file for playing the stream
app.get('/startStream', function(req,res){
    let userID = req.headers.user;
    if (!userID || !users.filtered('userID == $0',userID).length){
        return res.status(UNAUTH).json({"error":"Invalid userID"});
    }
	let videoID = req.query.videoID;
	if (!videoID){	//check if videoID is null or undefined
		res.status(BAD_REQ).json({"error":"No videoID in query"});
	} else {
		res.send(streamViewer.createHtmlPlayer(videoID));
	}
});

// Stream video
app.get('/stream',function(req,res){
    // Only for this endpoint userID should be query parameter to allow playing
    // the video in an AVPlayer using only the URL and not a URLRequest
    let userID = req.query.user;
    if (!userID || !users.filtered('userID == $0',userID).length){
        return res.status(UNAUTH).json({"error":"Invalid userID"});
    }
	let videoID = req.query.videoID
	if (videoID !== undefined && videoID){
		realmHandler.getVideoWithID(videoID).then(video=>{
			if (video !== undefined, video.filePath != null){
				// Get size information of video
				fs.stat(video.filePath, function(err,stats){
					if (err) {
						res.status(404).send(err);
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
							fs.createReadStream(video.filePath).pipe(res)
						} else {
							let positions = range.replace(/bytes=/, '').split('-');
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
							let stream = fs.createReadStream(video.filePath,streamPosition);
							stream.on('open',function(){
								stream.pipe(res);
							});
							stream.on('error',function(error){
								res.status(INT_ERROR).json({"error":error});
							});
						}
					}					
				});
			} else {
				res.status(UNAUTH).json({"error":"Invalid videoID"});
			}
		}).catch(error=>{
			console.log(error);
			res.status(INT_ERROR).json({"error":error});
		});
	} else {
		res.status(BAD_REQ).json({"error":"No videoID in query"});
	}
});

// Rate a video
app.post('/videos/rate', function(req,res){
    let userID = req.headers.user;
    let thisUser = users.filtered('userID == $0',userID);
    if (!userID || !thisUser){
        return res.status(UNAUTH).json({"error":"Invalid userID"});
    }
    const videoID = req.body.videoID;
    const rating = req.body.rating;
    if (!videoID || !rating){
        res.status(BAD_REQ).json({"error":"No videoID "+videoID+" or rating "+rating+" in request body"});
    } else {
        realmHandler.getVideoWithID(videoID).then(video=>{
			if (video !== undefined){
				// Create rating
                realmHandler.rateVideo(thisUser[0],video,rating).then( ()=>{
                    res.status(CREATED).json({"message":"Rating saved"});
                }).catch(error =>{
                    res.status(INT_ERROR).json({"error":error});
                });
			} else {
				res.status(BAD_REQ).json({"error":"Invalid videoID"});
			}
		}).catch(error=>{
			console.log(error);
			res.status(INT_ERROR).json({"error":error});
		});
    }
});

// Upload userlog
app.post('/userlogs', function(req,res){
    let userID = req.headers.user;
    let thisUser = users.filtered('userID == $0',userID);
    if (!userID || !thisUser){
        return res.status(UNAUTH).json({"error":"Invalid userID"});
    }
    // Parse userlog from request body, then save it to Realm
    let userLogs = req.body;
    // Validate the request body
    realmHandler.addUserLogsForUser(userLogs,thisUser[0]).then( ()=>{
        res.status(CREATED).json({"message":"UserLogs saved"});
    }).catch(error=>{
        res.status(INT_ERROR).json({"error":error});
    });
});

// Upload app usage logs
app.post('/applogs', function(req,res){
    let userID = req.headers.user;
    let thisUser = users.filtered('userID == $0',userID);
    if (!userID || !thisUser){
        return res.status(UNAUTH).json({"error":"Invalid userID"});
    }
    // Parse app usage logs from request body, then save it to Realm
    let appLogs = req.body;
    if (!appLogs){
        console.log("Empty applogs request");
        return res.status(BAD_REQ).json({"error":"No logs in body"});
    }
    realmHandler.addAppLogsForUser(appLogs, thisUser[0]).then( ()=>{
        res.status(CREATED).json({"message":"AppUsageLogs saved"});
    }).catch(error => {
        res.status(INT_ERROR).json({"error":error});
    });
});

// Send 404 for all undefined paths
app.use(function(err,req,res,next){
    let userID = req.headers.user;
    if (!userID || !users.filtered('userID == $0',userID).length){
        return res.status(UNAUTH).json({"error":"Invalid userID"});
    }
	console.log('Request failed to ' + req.url);
	res.status(404).json({"error":"Invalid endpoint"});
});

// Start the server
app.listen(3000, () => console.log('Cache manager listening on port 3000!'));

