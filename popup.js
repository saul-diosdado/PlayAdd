/*
    File: popup.js
    Purpose: Script that makes API calls to Spotify.
*/

/*--------------------------------------------------------------------------*/
/* HTML ELEMENTS */
/*--------------------------------------------------------------------------*/

let coverArtElement = document.getElementById("track-art");
let trackNameElement = document.getElementById("track-name");
let artistNameElement = document.getElementById("artist-name");
let trackPanelElement = document.getElementById("track-panel");

trackPanelElement.addEventListener("click", () => {
    chrome.storage.local.get("spotify_track_url", (item) => {
        if (item.spotify_track_url != null) {
            window.open(item.spotify_track_url);
        }
    });
});

// Retrieve the YouTube video title from storage and parse it.
chrome.storage.local.get("yt_video_title", (item) => {
    spotifySearch(parseTitle(item.yt_video_title));
});

// Call spotify API "search" endpoint which returns a list of tracks in JSON. 
function spotifySearch(title) {
    const searchEndpoint = "https://api.spotify.com/v1/search";
    let q = encodeURIComponent(title);
    const type = "track";
    const limit = "1";

    const searchURL = searchEndpoint + 
            "?q=" + q + 
            "&type=" + type + 
            "&limit=" + limit;
    
    chrome.storage.local.get("access_token", (item) => {
        let xmlHTTP = new XMLHttpRequest();
        xmlHTTP.open("GET", searchURL, true);
        xmlHTTP.setRequestHeader("Authorization", "Bearer " + item.access_token);
        xmlHTTP.onreadystatechange = () => {
            if (xmlHTTP.readyState === 4 && xmlHTTP.status === 200) {
                if (JSON.parse(xmlHTTP.responseText).tracks.items.length === 0) {
                    console.log("Sorry, couldn't find this song on Spotify.");

                    // Since no Spotify track was found, delete the Spotify data keys from storage.
                    chrome.storage.local.remove(["spotify_track_url", "spotify_track_uri"]);
                } else {
                    // Gather information from response.
                    let trackObject = JSON.parse(xmlHTTP.responseText).tracks.items[0];
                    let coverArtURL = trackObject.album.images[0].url;
                    let trackName = trackObject.name;
                    let artistNames = trackObject.artists[0].name;
                    for (let i = 1; i < trackObject.artists.length; i++) {
                        artistNames += ", " + trackObject.artists[i].name;
                    }
    
                    // Use the gathered information to update the Popup UI.
                    spotifyUpdateUI(coverArtURL, trackName, artistNames);
    
                    // Store the Spotify link to the track and the URI (unique identifier used to then add to a playlist).
                    chrome.storage.local.set({"spotify_track_url": trackObject.external_urls.spotify});
                    chrome.storage.local.set({"spotify_track_uri": trackObject.uri});
                }
            }
        }
        xmlHTTP.send();
    });
}

/**
 * Updates the Popup UI with the data retrieved from the Spotify Search API call.
 * @param {string} coverURL The URL to the cover art image
 * @param {string} song The song name
 * @param {string} artist The artist name
 */
function spotifyUpdateUI(coverURL, song, artist) {
    coverArtElement.src = coverURL;
    trackNameElement.innerText = song;
    artistNameElement.innerText = artist;
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
