var ytDownloader = require('./ytDownloader');
var url = 'https://www.youtube.com/watch?v=QNNcl2mEHzQ';
ytDownloader.getThumbnails(url);
ytDownloader.downloadVideo(url);
