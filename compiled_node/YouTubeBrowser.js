"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const googleapis_1 = require("googleapis");
const YouTube = googleapis_1.google.youtube({
    version: 'v3',
    auth: 'AIzaSyBHmIX8EfCwI1o77jUpjtM1gCP1wlQRPOk'
});
/**
   @desc List of available video categories from YouTube.
   @type Promise<youtube_v3.Schema$VideoCategory[]>
   */
exports.videoCategories = YouTube.videoCategories.list({ part: 'snippet', regionCode: 'GB' }).then(videoCategories => {
    if (videoCategories.data.items) {
        return videoCategories.data.items;
    }
    else {
        throw Error(videoCategories.status + videoCategories.statusText);
    }
});
/**
   @desc Return the most popular videos in a given video category.
   @param {string} category video category id to search for popular videos
   @param {int} maxResults maximum number of videos returned as a result
   @return Promise<youtube_v3.Schema$Video[]>
   */
function mostPopularVideosInCategory(category, maxResults = 20) {
    return exports.videoCategories.then(categories => {
        return YouTube.videos.list({ part: 'snippet,contentDetails,statistics', chart: 'mostPopular', videoCategoryId: category, maxResults: maxResults, regionCode: 'GB' }).then(videos => {
            if (videos.data.items) {
                return videos.data.items;
            }
            else {
                throw Error(videos.status + videos.statusText);
            }
        });
    });
}
exports.mostPopularVideosInCategory = mostPopularVideosInCategory;
/**
   @desc Get details about a YouTube video.
   @param {string} videoId id of the video to search
   @return Promise<youtube_v3.Schema$VideoSnippet>
*/
function videoDetails(videoId) {
    return YouTube.videos.list({ part: 'snippet', id: videoId }).then(matchingVideosResp => {
        const matchingVideos = matchingVideosResp.data.items;
        if (matchingVideos && matchingVideos.length > 0) {
            if (matchingVideos[0].snippet) {
                return matchingVideos[0].snippet;
            }
            else {
                throw Error("No snippet returned for video " + videoId);
            }
        }
        else {
            throw Error(matchingVideosResp.status + matchingVideosResp.statusText);
        }
    });
}
exports.videoDetails = videoDetails;
//# sourceMappingURL=YouTubeBrowser.js.map