var fs = require('fs');
var youtubedl = require('youtube-dl');

function getVideoInfo(youtubeUrl){
    var promise = { hasRun: false, result: null };
    object.event = youtubedl.getInfo(url, options, function(err, info) {
        if (err) throw err;

        console.log('id:', info.id);
        console.log('title:', info.title);
        console.log('url:', info.url);
        console.log('thumbnail:', info.thumbnail);
        console.log('description:', info.description);
        console.log('filename:', info._filename);
        console.log('format id:', info.format_id);

        promise.hasRun = true;
        promise.result = info.title;
    });
    return promise;
}

function getThumbnails(youtubeUrl){
    var options = {
        // Downloads available thumbnail.
        all: false,
        // The directory to save the downloaded files in.
        cwd: __dirname+'/storage/thumbnails',
    };
    youtubedl.getThumbs(youtubeUrl, options, function(err, files) {
        if (err) throw err;
        console.log('thumbnail file downloaded:', files);
    });
}

function uploadVideo(youtubeUrl){
	// Should probably save videos based on their IDs, if file exists with given
	// ID, don't download the video again, same for thumbnails
    var video = youtubedl(youtubeUrl);
    // Called when the download starts
    video.on('info', function(info) {
        console.log('Download started');
        console.log('filename: ' + info._filename);
        console.log('title: ' + info.title);
        console.log('size: ' + info.size);
		console.log('id: ' + info.id);
        // Save downloaded video
        video.pipe(fs.createWriteStream('./storage/videos/'+ info.title + '.mp4'));
    });
}

// Make these function available from other files
module.exports.getThumbnails = getThumbnails;
module.exports.uploadVideo = uploadVideo;
module.exports.getVideoInfo = getVideoInfo;
