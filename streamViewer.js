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
