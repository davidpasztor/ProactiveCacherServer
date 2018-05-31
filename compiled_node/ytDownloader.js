"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const youtubedl = require("youtube-dl");
const realmHandler = require("./RealmHandler");
const log_1 = require("./log");
const videosDir = path.join(__dirname, '..', 'storage', 'videos');
const thumbnailsDir = path.join(__dirname, '..', 'storage', 'thumbnails');
// Download the thumbnail image for a youtube video
function getThumbnails(youtubeUrl, youtubeID) {
    var options = {
        // Downloads available thumbnail.
        all: false,
        // The directory to save the downloaded files in.
        cwd: thumbnailsDir,
    };
    youtubedl.getThumbs(youtubeUrl, options, function (err, files) {
        if (err)
            throw err;
        //console.log('thumbnail file downloaded:', files);
        let defaultThumbnailUrlString = path.join(thumbnailsDir, files[0]);
        let newThumbnailUrlString = path.join(thumbnailsDir, youtubeID + '.jpg');
        fs.rename(defaultThumbnailUrlString, newThumbnailUrlString, function (err) {
            if (err)
                throw err;
        });
    });
}
exports.getThumbnails = getThumbnails;
// Upload a Youtube video from the supplied link to the server without downloading
// it to a device first
function uploadVideo(youtubeUrl, youtubeID, user, rating) {
    var video = youtubedl(youtubeUrl);
    // Download video thumbnail
    getThumbnails(youtubeUrl, youtubeID);
    // Called when the download starts
    video.on('info', function (info) {
        console.log('Download started');
        console.log('filename: ' + info._filename);
        console.log('title: ' + info.title);
        console.log('size: ' + info.size);
        console.log('id: ' + info.id);
        console.log('categories: ' + info.categories);
        console.log('video length: ' + info.duration);
        //console.log(Object.getOwnPropertyNames(info));
        const thumbnailPath = path.join(thumbnailsDir, youtubeID + '.jpg');
        const videoPath = path.join(videosDir, youtubeID + '.mp4');
        realmHandler.getVideoCategories().then(videoCategories => {
            const category = videoCategories.filtered("name == $0", info.categories[0]);
            // Add video to Realm
            if (category.length > 0) {
                return realmHandler.addVideo(info.id, info.title, videoPath, thumbnailPath, category[0]);
            }
            else {
                return realmHandler.addVideo(info.id, info.title, videoPath, thumbnailPath);
            }
        }).then(() => {
            if (user !== undefined && rating !== undefined) {
                return realmHandler.getVideoWithID(info.id);
            }
            return undefined;
        }).then(video => {
            if (video) {
                realmHandler.rateVideo(user, video, rating);
                log_1.logger.info("Adding rating for video " + video.youtubeID + " while uploading it");
            }
        }).catch(error => {
            realmHandler.addVideo(info.id, info.title, videoPath, thumbnailPath);
            log_1.logger.error(error);
        });
        // Save downloaded video
        let fileStream = fs.createWriteStream(videoPath);
        video.pipe(fileStream);
        fileStream.on('finish', function () {
            log_1.logger.info("File " + youtubeID + ".mp4 saved");
        });
    });
}
exports.uploadVideo = uploadVideo;
//# sourceMappingURL=ytDownloader.js.map