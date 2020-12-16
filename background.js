/*
 * File: background.js
 * Purpose: Script runs in the background and listens to messages.
 */

/*--------------------------------------------------------------------------*/
/* CONSTANTS/GLOBAL VARIABLES */
/*--------------------------------------------------------------------------*/

// Matches any YouTube video URL (note the "/watch?")
const regexYTVideoURL = new RegExp("https:\/\/www\.youtube\.com\/watch\?\S*");

const DOMAIN_BACKEND = "https://playadd-for-spotify.herokuapp.com";

// The time between refreshing the access token (45 minutes).
const TOKEN_REFRESH_TIME = 2700000;
// Holds the interval object.
let tokenRefreshInterval = null;

/*--------------------------------------------------------------------------*/
/* CHROME API LISTENERS */
/*--------------------------------------------------------------------------*/

/**
 * Check if the user is logged in. If so, go ahead and refresh the access token.
 * Note that this only happens when the background script is first ran like when a
 * new Google Chrome window is opened.
 */
chrome.storage.local.get("login_status", (item) => {
    if (item.login_status) {
        // Go ahead and refresh the token immediately.
        spotifyRefreshToken();
        // Interval to now periodically refresh the token.
        tokenRefreshInterval = setInterval(spotifyRefreshToken, TOKEN_REFRESH_TIME);
    }
});

/**
 * Listens to messages from other scripts.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.message == "login") {
            spotifyLoginAuthorization();
        }else if (request.message == "logout") {
            spotifyLogout();
        }
    }
);

/**
 * Event listener when the Chrome extension is clicked in the navigation bar.
 */
chrome.browserAction.onClicked.addListener(() => {
    chrome.tabs.query({active: true, currentWindow: true}, (tab) => {
        // Check if the user is logged in. If not, show the login popup.
        chrome.storage.local.get("login_status", (item) => {
            if (item.login_status) {
                // Check if a YouTube video is being watched.
                if (regexYTVideoURL.test(tab[0].url)) {
                    chrome.browserAction.setPopup({popup: "popup.html"});
                    chrome.storage.local.set({"yt_video_title": tab[0].title});
                } else {
                    chrome.browserAction.setPopup({popup: ""});
                    chrome.browserAction.disable(tab[0].id);
                    chrome.storage.local.remove(["yt_video_title"]);
                }
            } else {
                chrome.browserAction.setPopup({popup: "login.html"});
            }
        });
    });
});

/**
 * Event listener which fires upon any change to a tab.
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // When a new page is loaded, set the popup to none so that the browserAction.onClicked can now fire.
    if (changeInfo.status == "complete") {
        chrome.browserAction.setPopup({popup: ""});
    }
});

/*--------------------------------------------------------------------------*/
/* SPOTIFY FUNCTIONS */
/*--------------------------------------------------------------------------*/

/**
 * Launch the "Authorization Code Flow", handle the response with the callback function.
 */
function spotifyLoginAuthorization() {
    chrome.identity.launchWebAuthFlow({
        url: "http://localhost:3000/api/spotify/login/",
        interactive: true
    }, (redirectURI) => {
        // Parse the URL query parameters into a JSON.
        let queryParameters = queryURLToJSON(redirectURI);

        // Store the tokens into storage.
        chrome.storage.local.set({"access_token": queryParameters.access_token});
        chrome.storage.local.set({"refresh_token": queryParameters.refresh_token});
        chrome.storage.local.set({"login_status": true});

        // Set an interval to refresh the access token periodically.
        tokenRefreshInterval = setInterval(spotifyRefreshToken, TOKEN_REFRESH_TIME);

        // Open the redirect page to show the user that they have successfully connected their Spotify account.
        window.open("chrome-extension://" + chrome.runtime.id + "/redirect.html");
    });
}

/**
 * Refresh the access token using the refresh token.
 */
function spotifyRefreshToken() {
    chrome.storage.local.get("refresh_token", (item) => {
        // Query parameters for making a request to the backend server.
        const refreshEndpoint = DOMAIN_BACKEND + "/api/spotify/refresh/";
        const refreshToken = item.refresh_token;

        // Build the request URI.
        const refreshQuery = refreshEndpoint + 
                "?refresh_token=" + encodeURIComponent(refreshToken);

        let xmlHTTP = new XMLHttpRequest();
        xmlHTTP.open("GET", refreshQuery, true);
        xmlHTTP.onreadystatechange = () => {
            if (xmlHTTP.readyState == 4 && xmlHTTP.status == 200) {
                // Upon receiving a response, store the new access token.
                let response = JSON.parse(xmlHTTP.responseText);

                // Store the tokens into storage.
                chrome.storage.local.set({"access_token": response.access_token});
                // Sometimes we will also get a new refresh token from Spotify. If so, store the new refresh token.
                if (response.hasOwnProperty("refresh_token")) {
                    chrome.storage.local.set({"refresh_token": response.refresh_token});
                }
            }
        }
        xmlHTTP.send();
    });
}

/**
 * Removes access and refresh token keys from chrome.storage and changes login status in chrome.storage.
 */
function spotifyLogout() {
    chrome.storage.local.remove(["access_token", "refresh_token"]);
    chrome.storage.local.set({"login_status": false});
    clearInterval(tokenRefreshInterval);
}

/*--------------------------------------------------------------------------*/
/* HELPER FUNCTIONS */
/*--------------------------------------------------------------------------*/

// Takes as parameter a URL and returns a JSON of the extracted query parameters.
function queryURLToJSON(string) {
    return JSON.parse('{"' + decodeURI(string.split('?')[1].replace(/&/g, "\",\"").replace(/=/g,"\":\"")) + '"}');
}