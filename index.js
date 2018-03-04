'use strict';
const {URL} = require('url');
const ytDownloader = require('./ytDownloader');
const http = require('http');
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const realmHandler = require('./RealmHandler');
const fs = require('fs');
const streamViewer = require('./streamViewer');

// Create Express app and set its port to 3000 by default
var app = express();
app.set('port',process.env.PORT || 3000);

// For JSON parsing
app.use(bodyParser.json());

// Files can be accessed by submitting calls to "http://IP_addr_here:PORT/storage/file/path/name.extension"
//app.use('/storage',express.static(path.join(__dirname, 'storage')));

app.get('/', (req, res) => res.send('Hello World!'));
app.get('/storage', (req,res) => res.send('GET request to storage'));

// Upload youtube video to server
app.post('/storage', function(req,res){
	let videoUrlString = req.body.url;
	// No URL parameter in request body, send error response
	if (videoUrlString === undefined){
		res.status(400).send("No URL in request");
	} else {
		let videoUrl = null;
		try {
			videoUrl = new URL(videoUrlString);	
		} catch (e) {	// Invalid URL, send error response
			console.log(e);
			res.status(400).send("URL "+videoUrlString+" is not valid");
		}
		if (videoUrl.host != "www.youtube.com"){
			res.status(400).send("Non-YouTube URL");
		} else {
			let youtubeIDregex = /\?v\=(\w+)/;
			let matches = youtubeIDregex.exec(videoUrl.search)
			if (matches  !== null){
				let videoID = matches[1];
				// Check if video is already on the server, only download it
				// if it wasn't added before
				realmHandler.getVideoWithID(videoID).then(video=>{
					if (video === undefined){
						ytDownloader.uploadVideo(videoUrlString, videoID);
						res.send("Download of " + videoUrl + " started");
					} else {
						res.send("Video is already saved on server");
					}
				}).catch(error=>{
					console.log(error);
					res.status(500).send(error);
				});
			} else {
				res.status(400).send("Invalid YouTube URL");
			}
		}
	}
});

// Get a list of available videos
app.get('/videos', function(req,res){
	realmHandler.getVideos().then(videos=>{
		res.send(Array.from(videos));
	}).catch(error=>{
		console.log(error);
		res.status(500).send(error);
	});
});

// Get thumbnail image for video
app.get('/thumbnail', function(req,res){
	let videoID = req.query.videoID
	// Check that videoID is not undefined or null
	if (videoID !== undefined && videoID){
		realmHandler.getVideoWithID(videoID).then(video=>{
			if (video !== undefined){
				res.sendFile(video.thumbnailPath);
			} else {
				res.status(401).send("Invalid videoID");
			}
		}).catch(error=>{
			console.log(error);
			res.status(500).send(error);
		});
	} else {
		res.status(401).send("No videoID in query");
	}
});

app.get('/startStream', function(req,res){
	let videoID = req.query.videoID;
	if (!videoID){	//check if videoID is null or undefined
		res.status(401).send("No videoID in query");
	} else {
		res.send(streamViewer.createHtmlPlayer(videoID));
	}
});

// Stream video
app.get('/stream',function(req,res){
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
								res.status(500).send(error);
							});
						}
					}					
				});
			} else {
				res.status(401).send("Invalid videoID");
			}
		}).catch(error=>{
			console.log(error);
			res.status(500).send(error);
		});
	} else {
		res.status(401).send("No videoID in query");
	}
});

// Send 404 for all undefined paths
app.use(function(err,req,res,next){
	console.log('Request failed to ' + req.url);
	res.status(404).send('File not found!');
});

// Start the server
app.listen(3000, () => console.log('Cache manager listening on port 3000!'));

