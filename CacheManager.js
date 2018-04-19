const apn = require('apn');
const fs = require('fs');

const options = {
  token: {
    key: __dirname+"/APNs/AuthKey_BZXD7BPD72.p8",
    keyId: "BZXD7BPD72",
    teamId: "2A6XVR8XB3"
  },
  production: false
};

var apnProvider = new apn.Provider(options);

// Used for groupping notifications on the device
const bundleId = "com.DavidPasztor.ProactiveCacher";

// Device token of my iPhone X - used for testing
// TODO: associate deviceTokens with users
let deviceToken = "8dfbc6124ec07f151b5d79c6c7a5273e2f444f696f797c215b293bfedbece29e";

// Send a push notification to request a UserLog object this often
const userLogRequestInterval = 15*60*1000;	// 15 minutes in milliseconds

// Send a push notification to the specified device token to request the 
// creation of a UserLog object and hence check network availability
function sendNetworkAvailabilityReqPush(deviceToken){
    let notification = new apn.Notification();
    notification.expiry = Math.floor(Date.now() / 1000) + 24 * 3600; // will expire in 24 hours from now
    notification.payload = {'message': 'Network Available'};
    // Silent notification must have contentAvailable set to 1 and must not
    // contain alert, sound or badge keys
    notification.contentAvailable = 1;  // Make the notification silent

    notification.topic = bundleId;     
    // Send the notification
    apnProvider.send(notification, deviceToken).then( result => {
        // Show the result of the send operation:
        console.log(result);
    });
}

// TODO: create function that calls sendNetworkAvailability at regular intervals 
// for all users supplied as its input argument --> call this from index.js once
// the users have been retrieved from Realm --> have to make sure that it works 
// for newly registered users as well, namely the users Results instance keeps 
// updating when its passed regularly to this function

// Send a push notification to all registered users to request the creation of
// a UserLog object and hence check network availability
function sendNetwAvailReqPushToAll(users){
	let notification = new apn.Notification();
	notification.expiry = Math.floor(Date.now()/1000)+3600; // expires in 1 hour
	notification.payload = {'message':'Network Available'};
	notification.contentAvailable = 1;
	notification.topic = bundleId;
	
	users.forEach(user => {
		//console.log("Preparing to send notification to " + user.userID);
		apnProvider.send(notification,user.userID).then( result => {
			console.log("At " + new Date());
			console.log(result);
			//console.log(result + " at " + new Date());
		});
	});
}

function pushVideoToDevice(videoID,deviceToken){
    let notification = new apn.Notification();
    notification.expiry = Math.floor(Date.now()/1000)+3600; // expire in 1 hour
    notification.payload = {'videoID':videoID};
    notification.contentAvailable = 1;  // Make the notification silent
	notification.topic = bundleId;
    
	apnProvider.send(notification, deviceToken).then( result => {
        console.log(result);
    });
}

//sendNetworkAvailabilityReqPush(deviceToken);
//pushVideoToDevice("zorKvDiLbxw",deviceToken);
  
// Close the server
// TODO: check if this is actually necessary or not?
//apnProvider.shutdown();

module.exports = {
    sendNetworkAvailabilityReqPush,
	sendNetwAvailReqPushToAll,
    pushVideoToDevice,
	userLogRequestInterval
}

//exports.userLogRequestInterval = userLogRequestInterval;
