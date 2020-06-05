// Matches any YouTube video URL (note the "/watch?")
const regexYTVideoURL = /https:\/\/www\.youtube\.com\/watch\?\S*/gm;
// Matches access granted/denied after Spotify Web Authrorization redirect
const regexAccessGranted = /http:\/\/localhost:8888\/callback#access_token=*/gm;
const regexAccessDenied = /http:\/\/localhost:8888\/callback\?error=access_denied/gm;

// Query response parameters from a successful authorization. Parsed from the URL hash fragment.
let accessToken = "";
let tokenType = "";
let tokenExpiresIn = "";

// Login button event listener on the popup.html.
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginButton').addEventListener('click', implicitGrantLogin);
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
        accessToken = responseJSON.access_token;
        tokenType = responseJSON.token_type;
        tokenExpiresIn = responseJSON.expires_in;

        // Alert the user of succesful authorization.
        alert("Access granted for " + tokenExpiresIn + " seconds!");
    } else if (regexAccessDenied.exec(changeInfo.url)) {
        alert("Access denied!");
    }
});

// Uses Chrome API declarativeContent to only show the popup.html content when watching a YouTube video.
chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    chrome.declarativeContent.onPageChanged.addRules([{
        conditions: [new chrome.declarativeContent.PageStateMatcher({
            pageUrl: {hostEquals: "www.youtube.com/watch?*", schemes: ["https"]},
        }),
        new chrome.declarativeContent.PageStateMatcher({
            css: ["video"]
        })
    ],
    actions: [new chrome.declarativeContent.ShowPageAction()]
}]);
});

// Occurs only when the extension is installed (or refreshed). Will be changed later.
chrome.runtime.onInstalled.addListener(() => {
    implicitGrantLogin();
});

// Redirect user to Spotify authorization screen with parameters.
function implicitGrantLogin() {
    // Parameters for authorization.
    const authEndpoint = "https://accounts.spotify.com/authorize";
    const clientID = "a1064fa27beb43a38664d07aa5405304";
    const responseType = "token";
    const redirectURI = "http://localhost:8888/callback";
    const scope = "playlist-modify-public%playlist-modify-private";

    // Full authorization URL with parameters.
    const authorizeURL = authEndpoint + "?client_id=" + clientID + "&response_type=" +
            responseType + "&redirect_uri=" + encodeURIComponent(redirectURI) +
            "&scopes=" + encodeURIComponent(scope);

    // Redirect to authorization screen where user accepts or denies permissions.
    window.open(authorizeURL, "_blank"); 
}

// Convert an access granted URL hash fragment to a JSON.
function queryGrantedStringToJSON(string) {
    return JSON.parse('{"' + decodeURI(string.split('#')[1].replace(/&/g, "\",\"").replace(/=/g,"\":\"")) + '"}')
}