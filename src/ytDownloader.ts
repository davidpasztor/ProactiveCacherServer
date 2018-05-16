import fs = require('fs');
import path = require('path');
import { URL } from "url";
//import youtubedl = require('youtube-dl');
import * as youtubedl from "youtube-dl";
import realmHandler = require('./RealmHandler');

const videosDir = path.join(__dirname,'..','storage','videos');
const thumbnailsDir = path.join(__dirname,'..','storage','thumbnails');

// Download the thumbnail image for a youtube video
export function getThumbnails(youtubeUrl:string,youtubeID:string){
    var options = {
        // Downloads available thumbnail.
        all: false,
        // The directory to save the downloaded files in.
        cwd: thumbnailsDir,
    };
    youtubedl.getThumbs(youtubeUrl, options, function(err, files) {
        if (err) throw err;
        //console.log('thumbnail file downloaded:', files);
		let defaultThumbnailUrlString = path.join(thumbnailsDir,files[0]);
		let newThumbnailUrlString = path.join(thumbnailsDir,youtubeID+'.jpg');
		fs.rename(defaultThumbnailUrlString,newThumbnailUrlString,function(err){
			if (err) throw err;
		});
    });
}

// Upload a Youtube video from the supplied link to the server without downloading
// it to a device first
export function uploadVideo(youtubeUrl:string,youtubeID:string){
    var video = youtubedl(youtubeUrl);
	// Download video thumbnail
	getThumbnails(youtubeUrl,youtubeID);
    // Called when the download starts
    video.on('info', function(info) {
        console.log('Download started');
        console.log('filename: ' + info._filename);
        console.log('title: ' + info.title);
        console.log('size: ' + info.size);
		console.log('id: ' + info.id);
        console.log('categories: ' + info.categories);
        console.log('video length: '+info.duration);
        //console.log(Object.getOwnPropertyNames(info));
        const thumbnailPath = path.join(thumbnailsDir,youtubeID+'.jpg');
        const videoPath = path.join(videosDir,youtubeID+'.mp4');
		// Add video to Realm
		realmHandler.addVideo(info.id,info.title,videoPath,thumbnailPath);
        // Save downloaded video
        let fileStream = fs.createWriteStream(videoPath);
        video.pipe(fileStream);
        fileStream.on('finish', function(){
            console.log("File "+youtubeID+".mp4 saved");
        });
    });
}

