"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Realm = require("realm");
class Video {
}
Video.schema = {
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
exports.Video = Video;
class Rating {
}
Rating.schema = {
    name: 'Rating',
    properties: {
        score: 'double',
        user: 'User',
        video: 'Video'
    }
};
exports.Rating = Rating;
class BatteryStateLog {
}
BatteryStateLog.schema = {
    name: 'BatteryStateLog',
    properties: {
        batteryPercentage: 'int',
        batteryState: 'string'
    }
};
exports.BatteryStateLog = BatteryStateLog;
class UserLocation {
}
UserLocation.schema = {
    name: 'UserLocation',
    properties: {
        latitude: 'double',
        longitude: 'double'
    }
};
exports.UserLocation = UserLocation;
class UserLog {
}
UserLog.schema = {
    name: 'UserLog',
    properties: {
        location: 'UserLocation?',
        batteryState: 'BatteryStateLog?',
        networkStatus: 'string',
        timeStamp: 'date',
    }
};
exports.UserLog = UserLog;
class AppUsageLog {
}
AppUsageLog.schema = {
    name: 'AppUsageLog',
    properties: {
        appOpeningTime: 'date',
        watchedVideosCount: 'int'
    }
};
exports.AppUsageLog = AppUsageLog;
class User {
}
User.schema = {
    name: 'User',
    primaryKey: 'userID',
    properties: {
        userID: 'string',
        ratings: { type: 'linkingObjects', objectType: 'Rating', property: 'user' },
        cachedVideos: 'Video[]',
        logs: 'UserLog[]',
        appUsageLogs: 'AppUsageLog[]'
    }
};
exports.User = User;
const allSchemas = [Video.schema, Rating.schema, BatteryStateLog.schema,
    UserLocation.schema, UserLog.schema, AppUsageLog.schema, User.schema];
const currentSchemaVersion = 4;
// Perform migration if needed, return the opened Realm instance in case of success
function performMigration() {
    return Realm.open({
        schema: allSchemas,
        schemaVersion: currentSchemaVersion,
        migration: (oldRealm, newRealm) => {
            if (oldRealm.schemaVersion < 2 && currentSchemaVersion == 2) {
                // Need to manually create the timeStampString property,
                // otherwise it will hold the default value and would be duplicated
                const oldObjects = oldRealm.objects(UserLog.schema);
                const newObjects = newRealm.objects(UserLog.schema);
                for (let i = 0; i < oldObjects.length; i++) {
                    newObjects[i].timeStampString = oldObjects[i].timeStamp.toISOString();
                }
            }
            //Realm will handle the migration itself
        }
    });
}
exports.performMigration = performMigration;
// Return an opened Realm instance
function openRealm() {
    return Realm.open({ schema: allSchemas, schemaVersion: currentSchemaVersion });
}
exports.openRealm = openRealm;
// Create a new Video object in Realm with the given properties
function addVideo(id, title, filePath, thumbnailPath) {
    Realm.open({ schema: allSchemas, schemaVersion: currentSchemaVersion }).then(realm => {
        try {
            realm.write(() => {
                if (realm.objectForPrimaryKey('Video', id) == undefined) {
                    realm.create('Video', { youtubeID: id, title: title, filePath: filePath, thumbnailPath: thumbnailPath, uploadDate: new Date() }, true);
                }
                else {
                    console.log('Video with id: ' + id + ' already exists');
                }
            });
        }
        catch (e) {
            console.log(e);
        }
    }).catch(error => {
        console.log(error);
    });
}
exports.addVideo = addVideo;
// Return all video objects from Realm as Result<Video> in a Promise
function getVideos() {
    return new Promise((resolve, reject) => {
        Realm.open({ schema: allSchemas, schemaVersion: currentSchemaVersion }).then(realm => {
            let videos = realm.objects(Video.schema);
            resolve(videos);
        }).catch(error => {
            reject(error);
        });
    });
}
exports.getVideos = getVideos;
// Return Video object with corresponding ID or undefined if it is not saved to Realm
function getVideoWithID(primaryKey) {
    return new Promise((resolve, reject) => {
        Realm.open({ schema: allSchemas, schemaVersion: currentSchemaVersion }).then(realm => {
            resolve(realm.objectForPrimaryKey(Video.schema, primaryKey));
        }).catch(error => {
            reject(error);
        });
    });
}
exports.getVideoWithID = getVideoWithID;
// Retrieve all ratings
function getRatings() {
    return new Promise((resolve, reject) => {
        Realm.open({ schema: allSchemas, schemaVersion: currentSchemaVersion }).then(realm => {
            resolve(realm.objects(Rating.schema));
        }).catch(error => {
            reject(error);
        });
    });
}
exports.getRatings = getRatings;
// Create/update a rating for an existing User and Video Object
function rateVideo(user, video, rating) {
    return new Promise((resolve, reject) => {
        Realm.open({ schema: allSchemas, schemaVersion: currentSchemaVersion }).then(realm => {
            let ratingObject = realm.objects(Rating.schema).filtered('user == $0 AND video == $1', user, video);
            try {
                realm.write(() => {
                    // If there is no previous rating, create one
                    if (ratingObject.length == 0) {
                        realm.create('Rating', { score: rating, user: user, video: video });
                    }
                    else {
                        ratingObject[0].score = rating;
                    }
                    resolve();
                });
            }
            catch (e) {
                reject(e);
            }
        }).catch(error => {
            reject(error);
        });
    });
}
exports.rateVideo = rateVideo;
// Return the User object corresponding to the userID in a Promise or undefined
// if the user wasn't found
function getUserWithID(userID) {
    return new Promise((resolve, reject) => {
        Realm.open({ schema: allSchemas, schemaVersion: currentSchemaVersion }).then(realm => {
            resolve(realm.objectForPrimaryKey('User', userID));
        }).catch(error => {
            reject(error);
        });
    });
}
exports.getUserWithID = getUserWithID;
// Create a new user object using the given userID and return a Promise<Void>
function createUser(userID) {
    return new Promise((resolve, reject) => {
        Realm.open({ schema: allSchemas, schemaVersion: currentSchemaVersion }).then(realm => {
            try {
                realm.write(() => {
                    realm.create('User', { userID: userID });
                    resolve();
                });
            }
            catch (e) {
                console.log(e);
            }
        }).catch(error => {
            console.log(error);
        });
    });
}
exports.createUser = createUser;
// Return a Results<User> object containing all Users in a Promise
function getUsers() {
    return new Promise((resolve, reject) => {
        Realm.open({ schema: allSchemas, schemaVersion: currentSchemaVersion }).then(realm => {
            resolve(realm.objects(User.schema));
        }).catch(error => {
            reject(error);
        });
    });
}
exports.getUsers = getUsers;
// Add UserLog objects to a User
function addUserLogsForUser(userLogs, user) {
    return new Promise((resolve, reject) => {
        Realm.open({ schema: allSchemas, schemaVersion: currentSchemaVersion }).then(realm => {
            try {
                realm.write(() => {
                    userLogs.forEach(log => user.logs.push(log));
                    resolve();
                });
            }
            catch (e) {
                console.log(e);
                reject(e);
            }
        }).catch(error => {
            console.log(error);
            reject(error);
        });
    });
}
exports.addUserLogsForUser = addUserLogsForUser;
// Add AppUsageLog objects to a User
function addAppLogsForUser(appLogs, user) {
    return new Promise((resolve, reject) => {
        Realm.open({ schema: allSchemas, schemaVersion: currentSchemaVersion }).then(realm => {
            try {
                realm.write(() => {
                    appLogs.forEach(log => user.appUsageLogs.push(log));
                    resolve();
                });
            }
            catch (e) {
                reject(e);
            }
        }).catch(error => {
            reject(error);
        });
    });
}
exports.addAppLogsForUser = addAppLogsForUser;
//# sourceMappingURL=RealmHandler.js.map