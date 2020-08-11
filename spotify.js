// Event listener on the popup.html.
document.addEventListener("DOMContentLoaded", () => {
    // Avoids error of trying to get loginButton which will not exist immediately (since it belongs in popup).
    try {
        // document.getElementById("spotify-button").addEventListener("click", () => {
        //     spotifySearch("Antidote", "Travis Scott");
        //     spotifyGetPlaylist("7KduQbOdd287FW3EOAVDje");
        //     spotifyGetUserURI();
        // });

        document.getElementById("track-panel").addEventListener("click", () => {
            alert("Clicked");
        });
    } catch {}
});

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
                // Prints "Listening to <track_name> by <artist>". 
                console.log(listeningInfo);
                // Prints API response in JSON format.
                console.log(parsedResponse);
                console.log("===============================");
                // Adds the search result by passing the URI of the playlist and URI of the track.
                spotifyPlaylistAdd("7KduQbOdd287FW3EOAVDje", parsedResponse.tracks.items[0].uri);
                spotifyGetTrack(parsedResponse.tracks.items[0].id);
            }
        }
        xmlHTTP.send();
    });
}

// Get track information including the track cover art given the track id.
function spotifyGetTrack(trackID) {
    const trackEndpoint = "https://api.spotify.com/v1/tracks";
    
    const trackURL = trackEndpoint +
            "/" + trackID;

    chrome.storage.local.get("accessToken", (item) => {
        let xmlHTTP = new XMLHttpRequest();
        xmlHTTP.open("GET", trackURL, true);
        xmlHTTP.setRequestHeader("Authorization", "Bearer " + item.accessToken);
        xmlHTTP.onreadystatechange = () => {
            if (xmlHTTP.readyState === 4 && xmlHTTP.status === 200) {
                console.log("Get Track Info");
                console.log(JSON.parse(xmlHTTP.responseText));
                console.log("===============================");
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
                console.log("===============================");
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
                console.log("===============================");
            }
        }
        xmlHTTP.send();
    });
}

// Get a list of all of the user's playlists including playlists the user follows.
function spotifyGetAllPlaylists(uri) {
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
                // Show only the playlist that belong to the user by comparing the "owner's" spotify uri's.
                let userPlaylists = JSON.parse(xmlHTTP.responseText).items;
                for (let i = 0; i < userPlaylists.length; i++) {
                    if (userPlaylists[i].owner.uri == uri) {
                        console.log(userPlaylists[i]);
                    }
                }
                console.log("===============================");
            }
        }
        xmlHTTP.send();
    });
}

function spotifyGetUserURI() {
    const userEndpoint = "https://api.spotify.com/v1/me";
    
    chrome.storage.local.get("accessToken", (item) => {
        let xmlHTTP = new XMLHttpRequest();
        xmlHTTP.open("GET", userEndpoint, true);
        xmlHTTP.setRequestHeader("Authorization", "Bearer " + item.accessToken);
        xmlHTTP.onreadystatechange = () => {
            if (xmlHTTP.readyState === 4 && xmlHTTP.status === 200) {
                console.log("Get User URI");
                console.log(JSON.parse(xmlHTTP.responseText).uri);
                console.log("===============================");
                spotifyGetAllPlaylists(JSON.parse(xmlHTTP.responseText).uri);
            }
        }
        xmlHTTP.send();
    });
}
