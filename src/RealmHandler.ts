import Realm = require('realm');
import { Results } from 'realm';
import { youtube_v3 } from 'googleapis';

export class Video {
    public static schema: Realm.ObjectSchema = {
        name: 'Video',
        primaryKey: 'youtubeID',
        properties: {
            youtubeID:     'string',
            title:         'string',
            filePath:      'string?',
            thumbnailPath: 'string?',
            uploadDate:    'date',
            category: 'VideoCategory'
        }
    }

    public youtubeID: string;
    public title: string;
    public filePath?: string | null;
    public thumbnailPath?: string | null;
    public uploadDate: Date;
    public category: VideoCategory;
}

export class VideoCategory {
    public static schema: Realm.ObjectSchema = {
        name: 'VideoCategory',
        primaryKey: 'id',
        properties: {
            id: 'string',
            name: 'string',
            isYouTubeCategory: 'bool',
            videos: {type: 'linkingObjects', objectType: 'Video', property: 'category'}
        }
    }

    public id: string;
    public name: string;
    public isYouTubeCategory: boolean;
    public videos: Realm.Results<Video>;
}

export class Rating {
    public static schema: Realm.ObjectSchema = {
        name: 'Rating',
        properties: {
            score: 'double',
            user: 'User',
            video: 'Video'
        }
    }

    public score: number;
    public user: User;
    public video: Video;
}

export class BatteryStateLog {
    public static schema: Realm.ObjectSchema = {
        name: 'BatteryStateLog',
        properties: {
            batteryPercentage: 'int',
            batteryState: 'string'
        }
    }

    public batteryPercentage: number;
    public batteryState: string;
}

export class UserLocation {
    public static schema: Realm.ObjectSchema = {
        name: 'UserLocation',
        properties: {
            latitude: 'double',
            longitude: 'double'
        }
    }

    public latitude: number;
    public longitude: number;
}

export class UserLog {
    public static schema: Realm.ObjectSchema = {
        name: 'UserLog',
        properties: {
            location: 'UserLocation?',
            batteryState: 'BatteryStateLog?',
            networkStatus: 'string',
            timeStamp: 'date',
        }
    }

    public location?: UserLocation | null;
    public batteryState? : BatteryStateLog | null;
    public networkStatus: string;
    public timeStamp: Date;
}

export class AppUsageLog {
    public static schema: Realm.ObjectSchema = {
        name: 'AppUsageLog',
        properties: {
            appOpeningTime: 'date',
            watchedVideosCount: 'int',
            watchedCachedVideosCount: 'int?',
            notWatchedCachedVideosCount: 'int?'
        }
    }

    public appOpeningTime: Date;
    public watchedVideosCount: number;
    public watchedCachedVideosCount: number | null;
    public notWatchedCachedVideosCount: number | null;
}

export class User {
    public static schema: Realm.ObjectSchema = {
        name: 'User',
        primaryKey: 'userID',
        properties: {
            userID: 'string',
            ratings: {type: 'linkingObjects',objectType: 'Rating',property:'user'},
            cachedVideos: 'Video[]',
            logs: 'UserLog[]',
            appUsageLogs: 'AppUsageLog[]'
        }
    }

    public userID: string;
    public ratings: Realm.Results<Rating>;
    public cachedVideos: Realm.List<Video>;
    public logs: Realm.List<UserLog>;
    public appUsageLogs: Realm.List<AppUsageLog>;
}

const allSchemas = [Video.schema,Rating.schema,BatteryStateLog.schema,
                    UserLocation.schema,UserLog.schema,AppUsageLog.schema,
                    User.schema,VideoCategory.schema];

const currentSchemaVersion:number = 7;

// Perform migration if needed, return the opened Realm instance in case of success
export function performMigration(){
    return Realm.open({
        schema: allSchemas,
        schemaVersion: currentSchemaVersion,
        migration: (oldRealm, newRealm) => {
			      if (oldRealm.schemaVersion < 2 && currentSchemaVersion == 2){
				        // Need to manually create the timeStampString property,
				        // otherwise it will hold the default value and would be duplicated
				        const oldObjects = oldRealm.objects<UserLog>(UserLog.schema.name);
				        const newObjects = newRealm.objects<UserLog>(UserLog.schema.name);
                for (let i=0;i<oldObjects.length;i++){
                    (<any>newObjects[i]).timeStampString = oldObjects[i].timeStamp.toISOString();
			          }
            }
            //Realm will handle the migration itself
        }
    });
}

// Return an opened Realm instance
export function openRealm(){
	return Realm.open({schema: allSchemas,schemaVersion: currentSchemaVersion});
}

// Create a new Video object in Realm with the given properties
export function addVideo(id:string,title:string,filePath:string,thumbnailPath:string,category?:VideoCategory){
	return new Promise((resolve,reject)=>{
        Realm.open({schema: allSchemas,schemaVersion: currentSchemaVersion}).then(realm => {
            try {
                realm.write( ()=>{
                    if (realm.objectForPrimaryKey('Video',id) == undefined) {
                        if (category){
                            realm.create('Video',{youtubeID:id,title:title,filePath:filePath,thumbnailPath:thumbnailPath,uploadDate: new Date(),category:category});
                        } else {
                            realm.create('Video',{youtubeID:id,title:title,filePath:filePath,thumbnailPath:thumbnailPath,uploadDate:new Date()},true);
                        }
                        resolve();
                    } else {
                        console.log('Video with id: '+id+' already exists');
                        resolve();
                    }
                });
            } catch (error) {
                reject(error);
            }
        }).catch(error=>reject(error));
    });
}

// Return all video objects from Realm as Result<Video> in a Promise
export function getVideos():Promise<Realm.Results<Video>>{
	return new Promise((resolve,reject) => {
		Realm.open({schema: allSchemas,schemaVersion: currentSchemaVersion}).then(realm => {
			let videos = realm.objects<Video>(Video.schema.name);
			resolve(videos);
		}).catch(error => {
			reject(error);
		});
	});
}

// Return Video object with corresponding ID or undefined if it is not saved to Realm
export function getVideoWithID(primaryKey:string):Promise<Video | undefined>{
	return new Promise((resolve,reject) => {
		Realm.open({schema: allSchemas,schemaVersion: currentSchemaVersion}).then(realm => {
			resolve(realm.objectForPrimaryKey(Video.schema.name,primaryKey));
		}).catch(error => {
			reject(error);
		});
	});
}

// Return all videos that have the specified category
export function getVideosInCategory(categoryId:string){
    return openRealm().then(realm=>{
        const category = realm.objectForPrimaryKey<VideoCategory>(VideoCategory.schema.name,categoryId);
        if (category){
            const videos = realm.objects<Video>(Video.schema.name);
            return videos.filtered("category == $0",category);
        } else {
            throw Error("Invalid categoryID: "+categoryId);
        }
    });
}

// Create a new video category
export function addVideoCategory(id:string,name:string,isYouTubeCategory:boolean):Promise<void>{
    return new Promise((resolve, reject)=>{
        openRealm().then(realm=>{
            try {
                realm.write(()=>{
                    realm.create(VideoCategory.schema.name,{id:id,name:name,isYouTubeCategory:isYouTubeCategory});
                    resolve();
                });
            } catch (error){
                reject(error);
            }
        }).catch(error=>{reject(error);});
    });
}

// Add the fetched YouTube video categories to Realm
export function addVideoCategories(youTubeCategories:youtube_v3.Schema$VideoCategory[]){
    return new Promise((resolve,reject)=>{
        openRealm().then(realm=>{
            try {
                realm.write(()=>{
                    for (let youTubeCategory of youTubeCategories){
                        if (youTubeCategory.snippet && youTubeCategory.snippet.title){
                            realm.create(VideoCategory.schema.name,{id:youTubeCategory.id,name:youTubeCategory.snippet.title,isYouTubeCategory:true});
                        }
                    }
                    resolve();
                });
            } catch (error){
                reject(error);
            }
        }).catch(error=>reject(error));
    });
}

// Return all VideoCategory objects from Realm
export function getVideoCategories(){
    return openRealm().then(realm=>{
        return realm.objects<VideoCategory>(VideoCategory.schema.name);
    });
}

// Retrieve all ratings
export function getRatings():Promise<Realm.Results<Rating>>{
    return new Promise((resolve,reject) => {
        Realm.open({schema: allSchemas,schemaVersion: currentSchemaVersion}).then(realm => {
            resolve(realm.objects<Rating>(Rating.schema.name));
        }).catch(error => {
            reject(error);
        });
    });
}

// Create/update a rating for an existing User and Video Object
export function rateVideo(user:User,video:Video,rating:number):Promise<void>{
    return new Promise((resolve,reject) => {
        Realm.open({schema: allSchemas,schemaVersion: currentSchemaVersion}).then(realm => {
            let ratingObject = realm.objects<Rating>(Rating.schema.name).filtered('user == $0 AND video == $1',user,video);
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
export function getUserWithID(userID:string):Promise<User>{
    return new Promise((resolve,reject) => {
        Realm.open({schema: allSchemas,schemaVersion: currentSchemaVersion}).then(realm => {
            resolve(realm.objectForPrimaryKey('User',userID));
        }).catch(error => {
            reject(error);
        });
    });
}

// Create a new user object using the given userID and return a Promise<Void>
export function createUser(userID:string):Promise<void>{
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
export function getUsers():Promise<Realm.Results<User>>{
    return new Promise((resolve,reject) => {
        Realm.open({schema: allSchemas,schemaVersion: currentSchemaVersion}).then(realm => {
            resolve(realm.objects<User>(User.schema.name));
        }).catch(error => {
            reject(error);
        });
    });
}

// Delete an existing User
export function deleteUser(user:User):Promise<void>{
    return new Promise((resolve,reject) => {
        Realm.open({schema: allSchemas,schemaVersion: currentSchemaVersion}).then(realm => {
            try {
                realm.write( ()=> {
                    realm.delete(user);
                    resolve();
                })
            } catch (error) {
                reject(error);
            }
        }).catch(error => {
            reject(error);
        })
    })
}

// Add UserLog objects to a User
export function addUserLogsForUser(userLogs:UserLog[],user:User):Promise<void>{
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
            reject(error);
        });
    });
}

// Add AppUsageLog objects to a User
export function addAppLogsForUser(appLogs:AppUsageLog[],user:User):Promise<void>{
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

