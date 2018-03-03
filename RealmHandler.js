'use strict';

const Realm = require('realm');

const VideoSchema = {
    name: 'Video',
	primaryKey: 'youtubeID',
    properties: {
        youtubeID: 'string',
        name: 'string',
        filePath: 'string?',
        thumbnailPath: 'string?'
    }
};

function addVideo(id,name,filePath,thumbnailPath){
	Realm.open({schema: [VideoSchema]}).then(realm => {
		try {
			realm.write( ()=>{
				if (realm.objectForPrimaryKey('Video',id) == undefined) {
					realm.create('Video',{youtubeID:id,name:name,filePath:
						filePath,thumbnailPath:thumbnailPath},true);
				} else {
					console.log('Video with id: '+id+' already exists');
				}
			});
		} catch (e) {
			console.log(e);
		}
	}).catch(error => {
		console.log(error);
	});
}

function getVideos(){
	return new Promise((resolve,reject) => {
		Realm.open({schema: [VideoSchema]}).then(realm => {
			let videos = realm.objects('Video');
			resolve(videos);
		}).catch(error => {
			reject(error);
		});
	});
}

function getVideoWithID(primaryKey){
	return new Promise((resolve,reject) => {
		Realm.open({schema: [VideoSchema]}).then(realm => {
			resolve(realm.objectForPrimaryKey('Video',primaryKey));
		}).catch(error => {
			reject(error);
		});
	});
}

module.exports = {
	addVideo,
	getVideos,
	getVideoWithID
}
