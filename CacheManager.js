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

let deviceToken = "8dfbc6124ec07f151b5d79c6c7a5273e2f444f696f797c215b293bfedbece29e";

// Prepare the notifications
let notification = new apn.Notification();
notification.expiry = Math.floor(Date.now() / 1000) + 24 * 3600; // will expire in 24 hours from now
notification.badge = 2;
notification.sound = "ping.aiff";
notification.alert = "Cache Server";
notification.payload = {'messageFrom': 'CacheServer'};

// Replace this with your app bundle ID:
notification.topic = "com.DavidPasztor.ProactiveCacher";
 
// Send the notification
apnProvider.send(notification, deviceToken).then( result => {
    // Show the result of the send operation:
    console.log(result);
});
  
// Close the server
apnProvider.shutdown();
