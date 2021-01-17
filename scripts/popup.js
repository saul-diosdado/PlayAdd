/**
 * File: popup.js
 * Purpose: Script that makes API calls to Spotify.
 */

/*--------------------------------------------------------------------------*/
/* HTML ELEMENTS */
/*--------------------------------------------------------------------------*/

let coverArtElement = document.getElementById("track-art");
let trackNameElement = document.getElementById("track-name");
let artistNameElement = document.getElementById("artist-name");
let trackPanelElement = document.getElementById("track-panel");
let userPlaylistsElement = document.getElementById("playlists-dropdown");
let addButtonElement = document.getElementById("add-button");

/*--------------------------------------------------------------------------*/
/* CONSTANTS/GLOBAL VARIABLES */
/*--------------------------------------------------------------------------*/

const DOMAIN_BACKEND = "http://localhost:3000";
const DOMAIN_COOKIE_STORE = "https://playadd-for-spotify.herokuapp.com";

/**
 * Makes the entire track panel div clickable. Opens the currently playing song in Spotify.
 */
trackPanelElement.addEventListener("click", () => {
    chrome.storage.local.get("spotifyTrack", (item) => {
        // Only make the div a hyperlink to the song when a song was found in the Spotify search query.
        if (item.spotifyTrack != null) {
            window.open(item.spotifyTrack.url);
        }
    });
});

/**
 * Add button adds the currently playing song to the selected playlist.
 */
addButtonElement.addEventListener("click", () => {
    chrome.storage.local.get("spotifyTrack", (item) => {
        if (item.spotifyTrack != null) {
            // A song was found by th Spotify search query.
            let selectedPlaylistID = userPlaylistsElement.value;
            let currentlyPlayingTrackURI = item.spotifyTrack.uri;
            spotifyPlaylistAdd(selectedPlaylistID, currentlyPlayingTrackURI)
        }
    });
});

/**
 * Retrieve the YouTube video title from storage and parse it to make a Spotify Search API call.
 * Once done, get all of the user's playlists and update the UI.
 */
chrome.storage.local.get(["ytVideoTitle", "previousYTTitle", "spotifyTrack"], (item) => {
    // Check if we have already searched for this YouTube title.
    if (item.previousYTTitle == item.ytVideoTitle) {
        // If so, we can just change the UI with the track object that was stored in the original search.
        spotifyUpdateUI(item.spotifyTrack);
    } else {
        spotifySearch(spotifyUpdateUI, parseTitle(item.ytVideoTitle));
        // Since we already did a search for this title, store it.
        chrome.storage.local.set({"previousYTTitle": item.ytVideoTitle});
    }

    // Always update the playlists drop-down menu.
    spotifyGetUserURI(spotifyGetUserPlaylists, spotifyUpdatePlaylistsUI);
});

/*--------------------------------------------------------------------------*/
/* SPOTIFY FUNCTIONS AND RESPECTIVE UI */
/*--------------------------------------------------------------------------*/

/**
 * Adds a song to a playlist.
 * @param {string} playlistID The ID of the selected playlist fromm the drop-down menu.
 * @param {string} trackURI The Spotify URI of the currently playing song.
 */
function spotifyPlaylistAdd(playlistID, trackURI) {
    const addEndpoint = "https://api.spotify.com/v1/playlists";
    const position = 0;

    const addURL = addEndpoint +
            "/" + playlistID +
            "/tracks?uris=" + encodeURIComponent(trackURI) +
            "&position=" + position;

    chrome.cookies.get({"name": "accessToken", "url": DOMAIN_COOKIE_STORE}, (cookie) => {
        let xmlHTTP = new XMLHttpRequest();
        xmlHTTP.open("POST", addURL, true);
        xmlHTTP.setRequestHeader("Authorization", "Bearer " + cookie.value);
        xmlHTTP.onreadystatechange = () => {
            if (xmlHTTP.readyState === 4 && xmlHTTP.status === 201) {
                alert("Added to playlist!");
            }
        }
        xmlHTTP.send();
    });
}

/**
 * Call the "Spotify Search" API to search for the song.
 * @param {function} callbackUpdateUI Function that updates the UI of the popup with the response data.
 * @param {string} title String to search for in the Spotify API.
 */
function spotifySearch(callbackUpdateUI, title) {
    const searchEndpoint = "https://api.spotify.com/v1/search";
    let q = encodeURIComponent(title);
    const type = "track";
    const limit = "1";

    const searchURL = searchEndpoint + 
            "?q=" + q + 
            "&type=" + type + 
            "&limit=" + limit;
    
    chrome.cookies.get({"name": "accessToken", "url": DOMAIN_COOKIE_STORE}, (cookie) => {
        let xmlHTTP = new XMLHttpRequest();
        xmlHTTP.open("GET", searchURL, true);
        xmlHTTP.setRequestHeader("Authorization", "Bearer " + cookie.value);
        xmlHTTP.onreadystatechange = () => {
            if (xmlHTTP.readyState === 4 && xmlHTTP.status === 200) {
                if (JSON.parse(xmlHTTP.responseText).tracks.items.length === 0) {
                    alert("Sorry, couldn't find this song on Spotify.");
                    chrome.storage.local.set({spotifyTrack: null});
                } else {
                    // Gather information from response.
                    let trackObject = JSON.parse(xmlHTTP.responseText).tracks.items[0];
                    // There may be multiple artists, if so append them together separated by commas.
                    let artistNames = trackObject.artists[0].name;
                    for (let i = 1; i < trackObject.artists.length; i++) {
                        artistNames += ", " + trackObject.artists[i].name;
                    }

                    // Gather important information from response into one object.
                    let spotifyTrack = {
                        name: trackObject.name,
                        artist: artistNames,
                        coverURL: trackObject.album.images[0].url,
                        url: trackObject.external_urls.spotify,
                        uri: trackObject.uri
                    }

                    // Store the object in chrome storage.
                    chrome.storage.local.set({spotifyTrack: spotifyTrack});
    
                    // Use the gathered information to update the Popup UI.
                    callbackUpdateUI(spotifyTrack);
                }
            }
        }
        xmlHTTP.send();
    });
}

/**
 * Updates the Popup UI with the data retrieved from the Spotify Search API call.
 * @param {object} spotifyTrack Object containing data of the song such as name, artists, and corresponding urls/uris.
 */
function spotifyUpdateUI(spotifyTrack) {
    if (spotifyTrack != null) {
        coverArtElement.src = spotifyTrack.coverURL;
        trackNameElement.innerText = spotifyTrack.name;
        artistNameElement.innerText = spotifyTrack.artist;
    }
}

/**
 * Since the Spotify API "Get Playlists" endpoint returns all playlists that the user has created and has followed,
 * we must filter the playlists that only the user can modify (i.e. the playlists the user has created). To do this
 * we need the user's URI and we can then compare the owner URI field found in each playlist Object.
 * @param {function} callbackGetPlaylists Function that takes the user URI and filters only the user's playlists.
 * @param {function} callbackUpdateUI Function that takes an array of playlists and populates the drop-down menu with the playlists.
 */
function spotifyGetUserURI(callbackGetPlaylists, callbackUpdateUI) {
    const userEndpoint = "https://api.spotify.com/v1/me";
    
    chrome.cookies.get({"name": "accessToken", "url": DOMAIN_COOKIE_STORE}, (cookie) => {
        let xmlHTTP = new XMLHttpRequest();
        xmlHTTP.open("GET", userEndpoint, true);
        xmlHTTP.setRequestHeader("Authorization", "Bearer " + cookie.value);
        xmlHTTP.onreadystatechange = () => {
            if (xmlHTTP.readyState === 4 && xmlHTTP.status === 200) {
                let userURI = JSON.parse(xmlHTTP.response).uri;
                callbackGetPlaylists(userURI, callbackUpdateUI);
            }
        }
        xmlHTTP.send();
    });
}

/**
 * Makes an API call to return the user's playlists. Filters only playlists that the user has created by comparing
 * the userURI argument with the uri found in the playlist object.
 * This function also updates the UI by passing the reponse to the callback fucntion.
 * @param {string} userURI The Spotify user URI of the user that logged into Spotify.
 * @param {function} callbackUpdateUI Function that takes an array of playlists and populates the drop-down menu with the playlists.
 */
function spotifyGetUserPlaylists(userURI, callbackUpdateUI) {
    // Query parameters.
    const playlistsEndpoint = "https://api.spotify.com/v1/me/playlists";

    // Build the request URI.
    const playlistsQuery = playlistsEndpoint;
    
    chrome.cookies.get({"name": "accessToken", "url": DOMAIN_COOKIE_STORE}, (cookie) => {
        let xmlHTTP = new XMLHttpRequest();
        xmlHTTP.open("GET", playlistsQuery, true);
        xmlHTTP.setRequestHeader("Authorization", "Bearer " + cookie.value);
        xmlHTTP.onreadystatechange = () => {
            if (xmlHTTP.readyState === 4 && xmlHTTP.status === 200) {
                // An array of all playlists the user has (including ones they only follow).
                let allUserPlaylists = JSON.parse(xmlHTTP.response).items;

                // Filter the playlists retrieved from API to only show the playlists the user created.
                let userCreatedPlaylists = [];
                for (playlist of allUserPlaylists) {
                    if (playlist.owner.uri == userURI) {
                        userCreatedPlaylists.push(playlist);
                    }
                }

                // Update the drop-down UI to show the user created playlists.
                callbackUpdateUI(userCreatedPlaylists);
            }
        }
        xmlHTTP.send();
    });
}

/**
 * Takes as parameter an array of the user's playlists, each of which is a playlist object.
 * Adds an option in the drop-down menu UI for each of the user's playlist. 
 * @param {array} playlists An array of JSON corresponding to the playlist object. 
 */
function spotifyUpdatePlaylistsUI(playlists) {
    // Iterate through all of the user's playlists.
    for (playlist of playlists) {
        // Construct the drop-down option.
        let option = document.createElement("option");
        option.value = playlist.id;
        option.text = playlist.name;

        // Append the drop-down option to the drop-down menu.
        userPlaylistsElement.appendChild(option);
    }
}

/*--------------------------------------------------------------------------*/
/* HELPER FUNCTIONS */
/*--------------------------------------------------------------------------*/

/**
 * Attempts to remove any unnecessary text from a YouTube video title such as "(OFFICIAL MUSIC VIDEO)"
 * or other information that is not either the name of the artist/s or name of the song.
 * @param {string} title The YouTube video title 
 */
function parseTitle(title) {
    let parsedTitle = title;
    // Since we received the title of the Chrome tab, we need to remove the " - YouTube" appended at the end.
    parsedTitle = parsedTitle.slice(0, -10);

    // Remove all text that is between parenthesis or brackets (), [], inclusive.
    parsedTitle = parsedTitle.replace(/ *\([^)]*\) */g, "");
    parsedTitle = parsedTitle.replace(/ *\[[^\]]*\] */g, "");
    
    // Remove any featured artists (improves likeliness of finding the Spotify song).
    parsedTitle = parsedTitle.replace(/ft\..+/g, "");
    parsedTitle = parsedTitle.replace(/feat\..+/g, "");
    parsedTitle = parsedTitle.replace(/featuring.+/g, "");

    return parsedTitle;
}
