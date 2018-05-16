'use strict';
var Realm = require('realm');
var VideoSchema = {
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
var RatingSchema = {
    name: 'Rating',
    properties: {
        score: 'double',
        user: 'User',
        video: 'Video'
    }
};
var BatteryStateLogSchema = {
    name: 'BatteryStateLog',
    properties: {
        batteryPercentage: 'int',
        batteryState: 'string'
    }
};
var UserLocationSchema = {
    name: 'UserLocation',
    properties: {
        latitude: 'double',
        longitude: 'double'
    }
};
var UserLogSchema = {
    name: 'UserLog',
    properties: {
        location: 'UserLocation?',
        batteryState: 'BatteryStateLog?',
        networkStatus: 'string',
        timeStamp: 'date'
    }
};
var AppUsageLogSchema = {
    name: 'AppUsageLog',
    properties: {
        appOpeningTime: 'date',
        watchedVideosCount: 'int'
    }
};
var UserSchema = {
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
var allSchemas = [VideoSchema, RatingSchema, BatteryStateLogSchema,
    UserLocationSchema, UserLogSchema, AppUsageLogSchema, UserSchema];
var currentSchemaVersion = 4;
// Perform migration if needed, return the opened Realm instance in case of success
function performMigration() {
    return Realm.open({
        schema: allSchemas,
        schemaVersion: currentSchemaVersion,
        migration: function (oldRealm, newRealm) {
            if (oldRealm.schemaVersion < 2 && currentSchemaVersion == 2) {
                // Need to manually create the timeStampString property,
                // otherwise it will hold the default value and would be duplicated
                var oldObjects = oldRealm.objects('UserLog');
                var newObjects = newRealm.objects('UserLog');
                for (var i = 0; i < oldObjects.length; i++) {
                    newObjects[i].timeStampString = oldObjects[i].timeStamp.toISOString();
                }
            }
            //Realm will handle the migration itself
        }
    });
}
// Return an opened Realm instance
function openRealm() {
    return Realm.open({ schema: allSchemas, schemaVersion: currentSchemaVersion });
}
// Create a new Video object in Realm with the given properties
function addVideo(id, title, filePath, thumbnailPath) {
    Realm.open({ schema: allSchemas, schemaVersion: currentSchemaVersion }).then(function (realm) {
        try {
            realm.write(function () {
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
    })["catch"](function (error) {
        console.log(error);
    });
}
// Return all video objects from Realm as Result<Video> in a Promise
function getVideos() {
    return new Promise(function (resolve, reject) {
        Realm.open({ schema: allSchemas, schemaVersion: currentSchemaVersion }).then(function (realm) {
            var videos = realm.objects('Video');
            resolve(videos);
        })["catch"](function (error) {
            reject(error);
        });
    });
}
// Return Video object with corresponding ID or undefined if it is not saved to Realm
function getVideoWithID(primaryKey) {
    return new Promise(function (resolve, reject) {
        Realm.open({ schema: allSchemas, schemaVersion: currentSchemaVersion }).then(function (realm) {
            resolve(realm.objectForPrimaryKey('Video', primaryKey));
        })["catch"](function (error) {
            reject(error);
        });
    });
}
// Retrieve all ratings
function getRatings() {
    return new Promise(function (resolve, reject) {
        Realm.open({ schema: allSchemas, schemaVersion: currentSchemaVersion }).then(function (realm) {
            resolve(realm.objects('Rating'));
        })["catch"](function (error) {
            reject(error);
        });
    });
}
// Create/update a rating for an existing User and Video Object
function rateVideo(user, video, rating) {
    return new Promise(function (resolve, reject) {
        Realm.open({ schema: allSchemas, schemaVersion: currentSchemaVersion }).then(function (realm) {
            var ratingObject = realm.objects('Rating').filtered('user == $0 AND video == $1', user, video);
            try {
                realm.write(function () {
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
        })["catch"](function (error) {
            reject(error);
        });
    });
}
// Return the User object corresponding to the userID in a Promise or undefined
// if the user wasn't found
function getUserWithID(userID) {
    return new Promise(function (resolve, reject) {
        Realm.open({ schema: allSchemas, schemaVersion: currentSchemaVersion }).then(function (realm) {
            resolve(realm.objectForPrimaryKey('User', userID));
        })["catch"](function (error) {
            reject(error);
        });
    });
}
// Create a new user object using the given userID and return a Promise<Void>
function createUser(userID) {
    return new Promise(function (resolve, reject) {
        Realm.open({ schema: allSchemas, schemaVersion: currentSchemaVersion }).then(function (realm) {
            try {
                realm.write(function () {
                    realm.create('User', { userID: userID });
                    resolve();
                });
            }
            catch (e) {
                console.log(e);
            }
        })["catch"](function (error) {
            console.log(error);
        });
    });
}
// Return a Results<User> object containing all Users in a Promise
function getUsers() {
    return new Promise(function (resolve, reject) {
        Realm.open({ schema: allSchemas, schemaVersion: currentSchemaVersion }).then(function (realm) {
            resolve(realm.objects('User'));
        })["catch"](function (error) {
            reject(error);
        });
    });
}
// Add UserLog objects to a User
function addUserLogsForUser(userLogs, user) {
    return new Promise(function (resolve, reject) {
        Realm.open({ schema: allSchemas, schemaVersion: currentSchemaVersion }).then(function (realm) {
            try {
                realm.write(function () {
                    userLogs.forEach(function (log) { return user.logs.push(log); });
                    resolve();
                });
            }
            catch (e) {
                console.log(e);
                reject(e);
            }
        })["catch"](function (error) {
            console.log(error);
            reject(e);
        });
    });
}
// Add AppUsageLog objects to a User
function addAppLogsForUser(appLogs, user) {
    return new Promise(function (resolve, reject) {
        Realm.open({ schema: allSchemas, schemaVersion: currentSchemaVersion }).then(function (realm) {
            try {
                realm.write(function () {
                    appLogs.forEach(function (log) { return user.appUsageLogs.push(log); });
                    resolve();
                });
            }
            catch (e) {
                reject(e);
            }
        })["catch"](function (error) {
            reject(error);
        });
    });
}
module.exports = {
    performMigration: performMigration,
    openRealm: openRealm,
    addVideo: addVideo,
    getVideos: getVideos,
    getVideoWithID: getVideoWithID,
    rateVideo: rateVideo,
    getUserWithID: getUserWithID,
    createUser: createUser,
    getUsers: getUsers,
    addUserLogsForUser: addUserLogsForUser,
    addAppLogsForUser: addAppLogsForUser
};
