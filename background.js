// Matches any YouTube video URL (note the "/watch?")
const regexYTVideoURL = /https:\/\/www\.youtube\.com\/watch\?\S*/gm;
// Matches access granted/denied after Spotify Web Authrorization redirect
const regexAccessGranted = /http:\/\/localhost:8888\/callback#access_token=*/gm;
const regexAccessDenied = /http:\/\/localhost:8888\/callback\?error=access_denied/gm;

// Event listener on the popup.html.
document.addEventListener("DOMContentLoaded", () => {
    // Avoids error of trying to get loginButton which will not exist immediately (since it belongs in popup).
    try {
        document.getElementById("loginButton").addEventListener("click", implicitGrantLogin);
        document.getElementById("spotifyButton").addEventListener("click", () => {
            spotifySearch("All Me", "Drake")
            spotifyGetPlaylist("7KduQbOdd287FW3EOAVDje");
            spotifyGetAllPlaylists();
        });
    } catch {}
});

// Listens to changes in browser URL.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Check if a YouTube video is being watched.
    if (regexYTVideoURL.exec(changeInfo.url)) {
        console.log("Watching a YouTube video!");
    }

    // Check if user was redirected to local host and verify if access was granted or denied.
    if (regexAccessGranted.exec(changeInfo.url)) {
        // Contains access_token, expires_in, and token_type.
        let responseJSON = queryGrantedStringToJSON(changeInfo.url);
        chrome.storage.local.set({"accessToken": responseJSON.access_token}, () => {
            console.log("accessToken set.");
        });
        // Alert the user of succesful authorization.
        alert("Access granted for " + responseJSON.expires_in + " seconds!");
    } else if (regexAccessDenied.exec(changeInfo.url)) {
        alert("Access denied!");
    }
});

// Redirect user to Spotify authorization screen with parameters.
function implicitGrantLogin() {
    // Parameters for authorization.
    const authEndpoint = "https://accounts.spotify.com/authorize";
    const clientID = "a1064fa27beb43a38664d07aa5405304";
    const responseType = "token";
    const redirectURI = "http://localhost:8888/callback";
    const scope = "playlist-modify-public playlist-modify-private playlist-read-private playlist-read-collaborative user-read-private user-read-email";

    // Full authorization URL with parameters.
    const authorizeURL = authEndpoint + 
            "?client_id=" + encodeURIComponent(clientID) + 
            "&response_type=" + responseType + 
            "&redirect_uri=" + encodeURIComponent(redirectURI) +
            "&scope=" + encodeURIComponent(scope);

    // Redirect to authorization screen where user accepts or denies permissions.
    window.open(authorizeURL, "_blank");
}

// Call spotify API "search" endpoint which returns a list of tracks in JSON. 
function spotifySearch(track, artist) {
    const searchEndpoint = "https://api.spotify.com/v1/search";
    const type = "track";
    const limit = "1";
    let query = encodeURIComponent("track:" + track + " artist:" + artist);

    const searchURL = searchEndpoint + 
            "?q=" + query + 
            "&type=" + type + 
            "&limit=" + limit;
    
    chrome.storage.local.get("accessToken", (item) => {
        let xmlHTTP = new XMLHttpRequest();
        xmlHTTP.open("GET", searchURL, true);
        xmlHTTP.setRequestHeader("Authorization", "Bearer " + item.accessToken);
        xmlHTTP.onreadystatechange = () => {
            if (xmlHTTP.readyState === 4 && xmlHTTP.status === 200) {
                console.log("Search Track & Artist");
                // Gather information from response.
                let parsedResponse = JSON.parse(xmlHTTP.responseText);
                let trackName = parsedResponse.tracks.items[0].name;
                let artistsName = parsedResponse.tracks.items[0].artists;
                
                // Build an information string to print to console.
                let listeningInfo = "Listening to " + trackName + " by ";
                for (let i = 0; i < artistsName.length; i++) {
                    listeningInfo += artistsName[i].name + " ";
                }
                console.log(listeningInfo);
                console.log(parsedResponse);
                spotifyPlaylistAdd("7KduQbOdd287FW3EOAVDje", parsedResponse.tracks.items[0].uri);
            }
        }
        xmlHTTP.send();
    });
}

// Add a track to a playlist given a playlist ID and the track URI.
function spotifyPlaylistAdd(playlistID, trackURI) {
    const addEndpoint = "https://api.spotify.com/v1/playlists";
    const position = 0;

    const addURL = addEndpoint +
            "/" + playlistID +
            "/tracks?uris=" + encodeURIComponent(trackURI) +
            "&position=" + position;

    chrome.storage.local.get("accessToken", (item) => {
        let xmlHTTP = new XMLHttpRequest();
        xmlHTTP.open("POST", addURL, true);
        xmlHTTP.setRequestHeader("Authorization", "Bearer " + item.accessToken);
        xmlHTTP.onreadystatechange = () => {
            if (xmlHTTP.readyState === 4 && xmlHTTP.status === 201) {
                console.log("Playlist Add");
                console.log(JSON.parse(xmlHTTP.responseText));
            }
        }
        xmlHTTP.send();
    });
}

// Retrieve the name of a playlist given a playlist ID.
function spotifyGetPlaylist(playlistID) {
    const playlistEndpoint = "https://api.spotify.com/v1/playlists";
    const fields = "name";

    const playlistURL = playlistEndpoint +
            "/" + playlistID +
            "?fields=" + encodeURIComponent(fields);

    chrome.storage.local.get("accessToken", (item) => {
        let xmlHTTP = new XMLHttpRequest();
        xmlHTTP.open("GET", playlistURL, true);
        xmlHTTP.setRequestHeader("Authorization", "Bearer " + item.accessToken);
        xmlHTTP.onreadystatechange = () => {
            if (xmlHTTP.readyState === 4 && xmlHTTP.status === 200) {
                console.log("Get Playlist");
                console.log(JSON.parse(xmlHTTP.responseText));
            }
        }
        xmlHTTP.send();
    });
}

// Get a list of all of the user's playlists including playlists the user follows.
function spotifyGetAllPlaylists() {
    const playlistEndpoint = "https://api.spotify.com/v1/me/playlists";
    const limit = 5;

    const playlistURL = playlistEndpoint +
            "?limit=" + limit;

    chrome.storage.local.get("accessToken", (item) => {
        let xmlHTTP = new XMLHttpRequest();
        xmlHTTP.open("GET", playlistURL, true);
        xmlHTTP.setRequestHeader("Authorization", "Bearer " + item.accessToken);
        xmlHTTP.onreadystatechange = () => {
            if (xmlHTTP.readyState === 4 && xmlHTTP.status === 200) {
                console.log("Get All Playlists");
                console.log(JSON.parse(xmlHTTP.responseText));
            }
        }
        xmlHTTP.send();
    });
}

// Uses Chrome API declarativeContent to only show the popup.html content when video content is playing.
chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    chrome.declarativeContent.onPageChanged.addRules([{
        conditions: [new chrome.declarativeContent.PageStateMatcher({
            pageUrl: {urlMatches: "https://www.youtube\.com/watch\?\S+"},
        }),
        new chrome.declarativeContent.PageStateMatcher({
            css: ["video"]
        })
    ],
        actions: [new chrome.declarativeContent.ShowPageAction()]
    }]);
});

// Convert an access granted URL hash fragment to a JSON.
function queryGrantedStringToJSON(string) {
    return JSON.parse('{"' + decodeURI(string.split('#')[1].replace(/&/g, "\",\"").replace(/=/g,"\":\"")) + '"}')
}