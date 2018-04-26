'use strict';

const Realm = require('realm');

const VideoSchema = {
    name: 'Video',
	primaryKey: 'youtubeID',
    properties: {
        youtubeID: 'string',
        title: 'string',
        filePath: 'string?',
        thumbnailPath: 'string?',
		uploadDate: 'date'
    }
};

const RatingSchema = {
	name: 'Rating',
	properties: {
        score: 'double',
		user: 'User',
		video: 'Video'
	}
};

const BatteryStateLogSchema = {
	name: 'BatteryStateLog',
	properties: {
		batteryPercentage: 'int',
		batteryState: 'string'
	}
};

const UserLocationSchema = {
    name: 'UserLocation',
    properties: {
        latitude: 'double',
        longitude: 'double'
    }
};

const UserLogSchema = {
    name: 'UserLog',
    properties: {
        location: 'UserLocation?',
        batteryState: 'BatteryStateLog?',
        networkStatus: 'string',
        timeStamp: 'date',
    }
};

const AppUsageLogSchema = {
    name: 'AppUsageLog',
    properties: {
        appOpeningTime: 'date',
        watchedVideosCount: 'int'
    }
}

const UserSchema = {
	name: 'User',
	primaryKey: 'userID',
	properties: {
		userID: 'string',
		ratings: {type: 'linkingObjects',objectType: 'Rating',property:'user'},
		cachedVideos: 'Video[]',
        logs: 'UserLog[]',
        appUsageLogs: 'AppUsageLog[]'
	}
};

const allSchemas = [VideoSchema,RatingSchema,BatteryStateLogSchema,
    UserLocationSchema,UserLogSchema,AppUsageLogSchema,UserSchema];

var currentSchemaVersion = 4;

// Perform migration if needed, return the opened Realm instance in case of success
function performMigration(){
    return Realm.open({
        schema: allSchemas,
        schemaVersion: currentSchemaVersion,
        migration: (oldRealm, newRealm) => {
			if (oldRealm.schemaVersion < 2 && currentSchemaVersion == 2){
				// Need to manually create the timeStampString property,
				// otherwise it will hold the default value and would be duplicated
				const oldObjects = oldRealm.objects('UserLog');
				const newObjects = newRealm.objects('UserLog');
                for (let i=0;i<oldObjects.length;i++){
                    newObjects[i].timeStampString = oldObjects[i].timeStamp.toISOString();
                }
			}
            //Realm will handle the migration itself
        }
    })
}

// Return an opened Realm instance
function openRealm(){
	return Realm.open({schema: allSchemas,schemaVersion: currentSchemaVersion});
}

// Create a new Video object in Realm with the given properties
function addVideo(id,title,filePath,thumbnailPath){
	Realm.open({schema: allSchemas,schemaVersion: currentSchemaVersion}).then(realm => {
		try {
			realm.write( ()=>{
				if (realm.objectForPrimaryKey('Video',id) == undefined) {
					realm.create('Video',{youtubeID:id,title:title,filePath:
						filePath,thumbnailPath:thumbnailPath,uploadDate:new Date()},true);
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

// Return all video objects from Realm as Result<Video> in a Promise
function getVideos(){
	return new Promise((resolve,reject) => {
		Realm.open({schema: allSchemas,schemaVersion: currentSchemaVersion}).then(realm => {
			let videos = realm.objects('Video');
			resolve(videos);
		}).catch(error => {
			reject(error);
		});
	});
}

// Return Video object with corresponding ID or undefined if it is not saved to Realm
function getVideoWithID(primaryKey){
	return new Promise((resolve,reject) => {
		Realm.open({schema: allSchemas,schemaVersion: currentSchemaVersion}).then(realm => {
			resolve(realm.objectForPrimaryKey('Video',primaryKey));
		}).catch(error => {
			reject(error);
		});
	});
}

// Retrieve all ratings
function getRatings(){
    return new Promise((resolve,reject) => {
        Realm.open({schema: allSchemas,schemaVersion: currentSchemaVersion}).then(realm => {
            resolve(realm.objects('Rating'));
        }).catch(error => {
            reject(error);
        });
    });
}

// Create/update a rating for an existing User and Video Object
function rateVideo(user,video,rating){
    return new Promise((resolve,reject) => {
        Realm.open({schema: allSchemas,schemaVersion: currentSchemaVersion}).then(realm => {
            let ratingObject = realm.objects('Rating').filtered('user == $0 AND video == $1',user,video);
            try {
                realm.write( ()=>{
                    // If there is no previous rating, create one
                    if (ratingObject.length == 0){
                        realm.create('Rating',{score:rating,user:user,video:video});
                    } else {    // If there is a previous rating, update its score
                        ratingObject[0].score = rating;
                    }
                    resolve();
                });
            } catch (e) {
                reject(e);
            }
        }).catch(error => {
            reject(error);
        });
    });
}

// Return the User object corresponding to the userID in a Promise or undefined
// if the user wasn't found
function getUserWithID(userID){
    return new Promise((resolve,reject) => {
        Realm.open({schema: allSchemas,schemaVersion: currentSchemaVersion}).then(realm => {
            resolve(realm.objectForPrimaryKey('User',userID));
        }).catch(error => {
            reject(error);
        });
    });
}

// Create a new user object using the given userID and return a Promise<Void>
function createUser(userID){
    return new Promise((resolve,reject) => {
        Realm.open({schema: allSchemas,schemaVersion: currentSchemaVersion}).then(realm => {
            try {
                realm.write( ()=>{
                    realm.create('User',{userID:userID});
                    resolve();
                });
            } catch (e) {
                console.log(e);
            }
        }).catch(error => {
            console.log(error);
        });
    });
}

// Return a Results<User> object containing all Users in a Promise
function getUsers(){
    return new Promise((resolve,reject) => {
        Realm.open({schema: allSchemas,schemaVersion: currentSchemaVersion}).then(realm => {
            resolve(realm.objects('User'));
        }).catch(error => {
            reject(error);
        });
    });
}

// Add UserLog objects to a User
function addUserLogsForUser(userLogs,user){
    return new Promise((resolve,reject) => {
        Realm.open({schema: allSchemas,schemaVersion: currentSchemaVersion}).then(realm => {
            try {
                realm.write( ()=>{
                    userLogs.forEach(log =>user.logs.push(log));
                    resolve();
                });
            } catch (e) {
                console.log(e);
                reject(e);
            }
        }).catch(error => {
            console.log(error);
            reject(e);
        });
    });
}

// Add AppUsageLog objects to a User
function addAppLogsForUser(appLogs,user){
    return new Promise((resolve,reject) => {
        Realm.open({schema: allSchemas, schemaVersion: currentSchemaVersion}).then(realm => {
            try {
                realm.write( ()=>{
                    appLogs.forEach(log => user.appUsageLogs.push(log));
                    resolve();
                });
            } catch (e) {
                reject(e);
            }
        }).catch(error => {
            reject(error);
        });
    });
}

module.exports = {
    performMigration,
	openRealm,
	addVideo,
	getVideos,
	getVideoWithID,
    rateVideo,
    getUserWithID,
    createUser,
    getUsers,
    addUserLogsForUser,
    addAppLogsForUser
}

