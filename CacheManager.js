const apn = require('apn');
const fs = require('fs');
const Recommender = require('likely');
const { logger } = require('./index.js');

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
let myDeviceToken = "8dfbc6124ec07f151b5d79c6c7a5273e2f444f696f797c215b293bfedbece29e";

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
		logger.verbose("Network availability request push result: "+result);
        console.log(result);
    });
}

// Send a push notification to all registered users to request the creation of
// a UserLog object and hence check network availability
function sendNetwAvailReqPushToAll(users){
	let notification = new apn.Notification();
	notification.expiry = Math.floor(Date.now()/1000)+3600; // expires in 1 hour
	notification.payload = {'message':'Network Available'};
	notification.contentAvailable = 1;
	notification.topic = bundleId;
	
	users.forEach(user => {
		apnProvider.send(notification,user.userID).then( result => {
			console.log("At " + new Date());
			console.log(result);
			logger.verbose("Network availability req push: "+result);
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
		logger.info("Content push result "+result);
        console.log(result);
    });
}

// Make a caching decision for the specific user - decide what content to push
// to the device (if any) and when to push it
// This function should be called every time a new AppUsageLog object is uploaded
// 
function makeCachingDecision(user){
	// Predict when the user will use the app the next time
	// Fetch the AppUsageLog object from the previous day closest to, but later
	// than the current time and find the last UserLog where the user had wifi
	// connection --> content pushing needs to happen at that point in time
	
    // Find the recommended movies for the user
	//var model = generatePredictedRatings(users,videos,currentRatings);
	//var recommendations = model.recommendations(user.userID);
}

// Make a caching decision for a specific user - simply predict the next time 
// they'll have wifi access and push a random video that they haven't cached yet
function makeCachingDecisionsV0(user,predictions){
	// UserLogs to use for network availability checking
	let wifiAvailabilityLogs = user.logs.filter('networkStatus == "WiFi"');
	// AppUsageLogs to predict the number of videos needed to be pushed and the
	// time of pushing (only care about logs where the user watched any videos)
	let appUsageLogs = user.appLogs.filter("watchedVideosCount > 0");

	// predictions is an array in the form 
	// [["label1",bestPredictedRating],...,["labelN",worstPredictedRating]], so
	// predictions[0][0] is the label (videoID) of the best recommendation

	// predictions only contains videos that have not been rated by the user yet,
	// so no need to worry about filtering them, also client-side check is 
	// already implemented to prevent downloading an already cached video
	
	// Need to time this function call
	pushVideoToDevice(predictions[0][0],user.userID);
}

// Helper function for creating an n-by-m matrix (2D array)
function createMatrix(n,m){
	var matrix = new Array(n);
	for (var i=0;i<n;i++){
		matrix[i] = new Array(m);        
	}
	return matrix;
}

// Generate the predicted ratings for all users
function generatePredictedRatings(users,videos,currentRatings){
    // Create the rowLabels (userID)
	let rowLabels = users.map(user => user.userID);
    // Create the column labels (videoID)
	let columnLabels = videos.map(video => video.youtubeID);

    // Create the input matrix in the form that rows represent users and columns 
    // represent ratings for a specific movie by each user
	var ratingsMatrix = createMatrix(rowLabels.length,columnLabels.length);
	ratingsMatrix.forEach(row => row.fill(0));  // likely needs 0s for the non-rated videos
	currentRatings.forEach(rating => {
		ratingsMatrix[rowLabels.indexOf(rating.user.userID)][columnLabels.indexOf(rating.video.youtubeID)] = rating.score        
	});
	console.log("Existing ratings:");
	console.log(ratingsMatrix);

    // Build the model
    var model = Recommender.buildModel(ratingsMatrix, rowLabels, columnLabels);
	return model; 
}

module.exports = {
    sendNetworkAvailabilityReqPush,
	sendNetwAvailReqPushToAll,
    pushVideoToDevice,
	userLogRequestInterval,
	generatePredictedRatings
}

