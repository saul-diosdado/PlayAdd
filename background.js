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
        document.getElementById("spotifyButton").addEventListener("click", () => {});
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
        // Set global query parameters from the response URL.
        let responseJSON = queryGrantedStringToJSON(changeInfo.url);
        chrome.storage.local.set({"accessToken": responseJSON.access_token}, () => {
            console.log("accessToken set.");
        });
        // Alert the user of succesful authorization.
        alert("Access granted for " + getTokenExpiresIn() + " seconds!");
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
    const scope = "playlist-modify-public playlist-modify-private user-read-private user-read-email";

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
            // Opens the first search result in spotify in a new tab.
            if (xmlHTTP.readyState === 4 && xmlHTTP.status === 200) {
                window.open(JSON.parse(xmlHTTP.responseText).tracks.items[0].external_urls.spotify, "_blank");
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