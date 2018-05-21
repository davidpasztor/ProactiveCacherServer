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
        uploadDate: 'date',
        category: 'VideoCategory'
    }
};
exports.Video = Video;
class VideoCategory {
}
VideoCategory.schema = {
    name: 'VideoCategory',
    primaryKey: 'id',
    properties: {
        id: 'string',
        name: 'string',
        isYouTubeCategory: 'bool',
        videos: { type: 'linkingObjects', objectType: 'Video', property: 'category' }
    }
};
exports.VideoCategory = VideoCategory;
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
    UserLocation.schema, UserLog.schema, AppUsageLog.schema,
    User.schema, VideoCategory.schema];
const currentSchemaVersion = 5;
// Perform migration if needed, return the opened Realm instance in case of success
function performMigration() {
    return Realm.open({
        schema: allSchemas,
        schemaVersion: currentSchemaVersion,
        migration: (oldRealm, newRealm) => {
            if (oldRealm.schemaVersion < 2 && currentSchemaVersion == 2) {
                // Need to manually create the timeStampString property,
                // otherwise it will hold the default value and would be duplicated
                const oldObjects = oldRealm.objects(UserLog.schema.name);
                const newObjects = newRealm.objects(UserLog.schema.name);
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
    //TODO: modify the function to return a Promise just like all other Realm funcs
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
            let videos = realm.objects(Video.schema.name);
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
            resolve(realm.objectForPrimaryKey(Video.schema.name, primaryKey));
        }).catch(error => {
            reject(error);
        });
    });
}
exports.getVideoWithID = getVideoWithID;
// Return all videos that have the specified category
function getVideosInCategory(categoryId) {
    return openRealm().then(realm => {
        const category = realm.objectForPrimaryKey(VideoCategory.schema.name, categoryId);
        if (category) {
            const videos = realm.objects(Video.schema.name);
            return videos.filtered("category == $0", category);
        }
        else {
            throw Error("Invalid categoryID: " + categoryId);
        }
    });
}
exports.getVideosInCategory = getVideosInCategory;
// Create a new video category
function addVideoCategory(id, name, isYouTubeCategory) {
    return new Promise((resolve, reject) => {
        openRealm().then(realm => {
            try {
                realm.write(() => {
                    realm.create(VideoCategory.schema.name, { id: id, name: name, isYouTubeCategory: isYouTubeCategory });
                    resolve();
                });
            }
            catch (error) {
                reject(error);
            }
        }).catch(error => { reject(error); });
    });
}
exports.addVideoCategory = addVideoCategory;
// Add the fetched YouTube video categories to Realm
function addVideoCategories(youTubeCategories) {
    return new Promise((resolve, reject) => {
        openRealm().then(realm => {
            try {
                realm.write(() => {
                    for (let youTubeCategory of youTubeCategories) {
                        if (youTubeCategory.snippet && youTubeCategory.snippet.title) {
                            realm.create(VideoCategory.schema.name, { id: youTubeCategory.id, name: youTubeCategory.snippet.title, isYouTubeCategory: true });
                        }
                    }
                    resolve();
                });
            }
            catch (error) {
                reject(error);
            }
        }).catch(error => reject(error));
    });
}
exports.addVideoCategories = addVideoCategories;
// Return all VideoCategory objects from Realm
function getVideoCategories() {
    return openRealm().then(realm => {
        return realm.objects(VideoCategory.schema.name);
    });
}
exports.getVideoCategories = getVideoCategories;
// Retrieve all ratings
function getRatings() {
    return new Promise((resolve, reject) => {
        Realm.open({ schema: allSchemas, schemaVersion: currentSchemaVersion }).then(realm => {
            resolve(realm.objects(Rating.schema.name));
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
            let ratingObject = realm.objects(Rating.schema.name).filtered('user == $0 AND video == $1', user, video);
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
            resolve(realm.objects(User.schema.name));
        }).catch(error => {
            reject(error);
        });
    });
}
exports.getUsers = getUsers;
// Delete an existing User
function deleteUser(user) {
    return new Promise((resolve, reject) => {
        Realm.open({ schema: allSchemas, schemaVersion: currentSchemaVersion }).then(realm => {
            try {
                realm.write(() => {
                    realm.delete(user);
                    resolve();
                });
            }
            catch (error) {
                reject(error);
            }
        }).catch(error => {
            reject(error);
        });
    });
}
exports.deleteUser = deleteUser;
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