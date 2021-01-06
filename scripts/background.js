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
const DOMAIN_COOKIE_STORE = "https://playadd-for-spotify.herokuapp.com";
const DOMAIN_EXTENSION = "chrome-extension://" + chrome.runtime.id;

// The time between refreshing the access token (45 minutes).
const TOKEN_REFRESH_TIME = 45 * 60 * 1000;
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
        } else if (request.message == "logout") {
            spotifyLogout();
        }
    }
);

/**
 * Event listener which fires upon any change to a tab.
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // The changeInfo object holds the values that have changed in the tab object when the user navigates to a new page.
    if (changeInfo.hasOwnProperty("url") && regexYTVideoURL.test(changeInfo.url)) {
        // The user is watching a YouTube video.
        chrome.storage.local.set({"is_watching_yt_video": true});
    } else if (changeInfo.hasOwnProperty("url") && !regexYTVideoURL.test(changeInfo.url)) {
        // The user is NOT watching a YouTube video.
        chrome.storage.local.set({"is_watching_yt_video": false});
        chrome.browserAction.setPopup({popup: "holder.html", tabId: tabId});
    }

    // The changeInfo object does not always have the "title" field, this avoids false negatives.
    if (changeInfo.hasOwnProperty("title")) {
        // If the user is watching a YouTube video, set the title and corresponding popups depending on login status.
        chrome.storage.local.get(["is_watching_yt_video", "login_status"], (item) => {
            if (item.is_watching_yt_video) {
                chrome.storage.local.set({"yt_video_title": changeInfo.title});
            }

            if (item.login_status && item.is_watching_yt_video) {
                chrome.browserAction.setPopup({popup: "popup.html", tabId: tabId});
            } else if (!item.login_status) {
                chrome.browserAction.setPopup({popup: "login.html", tabId: tabId});
            }
        })
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
        url: DOMAIN_BACKEND + "/api/spotify/login/",
        interactive: true
    }, (redirectURI) => {
        // Parse the URL query parameters into a JSON.
        let queryParameters = queryURLToJSON(redirectURI);

        // Store the tokens into storage.
        chrome.cookies.set({"httpOnly": true, "name": "access_token", "url": DOMAIN_COOKIE_STORE, "value": queryParameters.access_token});
        chrome.cookies.set({"httpOnly": true, "name": "refresh_token", "url": DOMAIN_COOKIE_STORE, "value": queryParameters.refresh_token});
        chrome.storage.local.set({"login_status": true});

        // Set an interval to refresh the access token periodically.
        tokenRefreshInterval = setInterval(spotifyRefreshToken, TOKEN_REFRESH_TIME);

        // Open the redirect page to show the user that they have successfully connected their Spotify account.
        window.open(DOMAIN_EXTENSION + "/redirect.html");
    });
}

/**
 * Refresh the access token using the refresh token.
 */
function spotifyRefreshToken() {
    chrome.cookies.get({"name": "refresh_token", "url": DOMAIN_COOKIE_STORE}, (cookie) => {
        try {
            // Query parameters for making a request to the backend server.
            const refreshEndpoint = DOMAIN_BACKEND + "/api/spotify/refresh/";
            const refreshToken = cookie.value;
    
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
                    chrome.cookies.set({"httpOnly": true, "name": "access_token", "url": DOMAIN_COOKIE_STORE, "value": response.access_token});
                    // Sometimes we will also get a new refresh token from Spotify. If so, store the new refresh token.
                    if (response.hasOwnProperty("refresh_token")) {
                        chrome.cookies.set({"httpOnly": true, "name": "refresh_token", "url": DOMAIN_COOKIE_STORE, "value": response.refresh_token});
                    }
                }
            }
            xmlHTTP.send();
        } catch (error) {
            // More than likely an error occured because there is no active refresh token stored. In this case set the login status to false.
            chrome.storage.local.set({"login_status": false});
        }
    });
}

/**
 * Removes access and refresh token keys from chrome.storage and changes login status in chrome.storage.
 */
function spotifyLogout() {
    chrome.cookies.remove({"name": "access_token", "url": DOMAIN_BACKEND});
    chrome.cookies.remove({"name": "refresh_token", "url": DOMAIN_BACKEND});
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