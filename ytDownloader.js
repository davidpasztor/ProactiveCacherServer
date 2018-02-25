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

function downloadVideo(youtubeUrl){
    var video = youtubedl(youtubeUrl);
    // Called when the download starts
    video.on('info', function(info) {
        console.log('Download started');
        console.log('filename: ' + info._filename);
        console.log('size: ' + info.size);
        // Save downloaded video
        video.pipe(fs.createWriteStream('./videos/'+info._filename));
    });
}

module.exports.downloadVideo = downloadVideo;
module.exports.getVideoInfo = getVideoInfo;
