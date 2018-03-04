/*
document.addEventListener('DOMContentLoaded', init, false);

function init() {
    const VP = document.getElementById('videoPlayer')
    const VPToggle = document.getElementById('toggleButton')

    VPToggle.addEventListener('click', function() {
        if (VP.paused) VP.play()
        else VP.pause()
    })
}
*/

// Create a HTML string for playing the requested video in a browser (or WKWebView)
function createHtmlPlayer(videoID){
	const htmlPlayerString = `
	<html>
	  <head>
		<title>Live video streamer</title>
	  </head>
	  <body>
		<video id="videoPlayer" controls>
		  <source src="http://localhost:3000/stream?videoID=${videoID}" type="video/mp4">
		</video>
	  </body>
	</html>
	`
	return htmlPlayerString
}

module.exports = {
	createHtmlPlayer
}
