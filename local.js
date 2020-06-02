// Load HTTP library.
var http = require("http");

// Create server and handle responses.
http.createServer(function(request, response) {
    response.writeHead(200, {"Content-Type": "text/plain"});
    response.write("Spotify Redirect URI");
    response.end();
}).listen(8888);