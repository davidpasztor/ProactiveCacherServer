'use strict';
const {URL} = require('url');
const ytDownloader = require('./ytDownloader');
const http = require('http');
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const realmHandler = require('./RealmHandler');

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
	// In the future might want to check if the request has the expected format before doing any processing
	let videoUrlString = req.body.url;
	if (videoUrlString === undefined){
		res.status(400).send("No URL in request");
	} else {
		let videoUrl = null;
		try {
			videoUrl = new URL(videoUrlString);	
		} catch (e) {
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
				realmHandler.getVideoWithID(videoID).then(video=>{
					if (video === undefined){
						ytDownloader.uploadVideo(videoUrlString);
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
		res.send(videos);
	}).catch(error=>{
		console.log(error);
		res.status(500).send(error);
	});
});

// Send 404 for all undefined paths
app.use(function(err,req,res,next){
	console.log('Request failed to ' + req.url);
	res.status(404).send('File not found!');
});

// Start the server
app.listen(3000, () => console.log('Cache manager listening on port 3000!'));

//var url = 'https://www.youtube.com/watch?v=QNNcl2mEHzQ';
//ytDownloader.getThumbnails(url);
//ytDownloader.downloadVideo(url);
