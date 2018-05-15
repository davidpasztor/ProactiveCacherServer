const fs = require('fs');
const {URL} = require('url');
const youtubedl = require('youtube-dl');
const realmHandler = require('./RealmHandler');

// Download the thumbnail image for a youtube video
function getThumbnails(youtubeUrl,youtubeID){
    var options = {
        // Downloads available thumbnail.
        all: false,
        // The directory to save the downloaded files in.
        cwd: __dirname+'/storage/thumbnails',
    };
    youtubedl.getThumbs(youtubeUrl, options, function(err, files) {
        if (err) throw err;
        //console.log('thumbnail file downloaded:', files);
		let defaultThumbnailUrlString = __dirname+'/storage/thumbnails/'+files[0];
		let newThumbnailUrlString = __dirname+'/storage/thumbnails/'+youtubeID+'.jpg';
		fs.rename(defaultThumbnailUrlString,newThumbnailUrlString,function(err){
			if (err) throw err;
		});
    });
}

// Upload a Youtube video from the supplied link to the server without downloading
// it to a device first
function uploadVideo(youtubeUrl,youtubeID){
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
		// Add video to Realm
		realmHandler.addVideo(info.id,info.title,__dirname+'/storage/videos/'+
			youtubeID+'.mp4',__dirname+'/storage/thumbnails/'+youtubeID+'.jpg');
        // Save downloaded video
        var fileStream = fs.createWriteStream(__dirname+'/storage/videos/'+
            youtubeID+'.mp4')
        video.pipe(fileStream);
        fileStream.on('finish', function(){
            console.log("File "+youtubeID+".mp4 saved");
        });
    });
}

// Make these function available from other files
module.exports = {
	getThumbnails,
	uploadVideo
}

