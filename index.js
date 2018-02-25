'use strict';

var ytDownloader = require('./ytDownloader');
var http = require('http');
var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');

// Create Express app and set its port to 3000 by default
var app = express();
app.set('port',process.env.PORT || 3000);

// For JSON parsing
app.use(bodyParser.json());

// Files can be accessed by submitting calls to "http://IP_addr_here:PORT/storage/file/path/name.extension"
//app.use('/storage',express.static(path.join(__dirname, 'storage')));

app.get('/', (req, res) => res.send('Hello World!'));
app.get('/storage', (req,res) => res.send('GET request to storage'));

app.post('/storage', function(req,res){
	// In the future might want to check if the request has the expected format before doing any processing
	var videoUrl = req.body["url"];
	ytDownloader.uploadVideo(videoUrl);
	res.send("Download of " + videoUrl + " started");
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
