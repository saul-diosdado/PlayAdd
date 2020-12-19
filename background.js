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

// The time between refreshing the access token in minutes.
const TOKEN_REFRESH_TIME = 45;

/*--------------------------------------------------------------------------*/
/* CHROME API LISTENERS */
/*--------------------------------------------------------------------------*/

/**
 * Check if the user is logged in. If so, go ahead and refresh the access token.
 * Note that this only happens when the background script is first ran like when a
 * new Google Chrome window is opened.
 */
chrome.windows.onCreated.addListener(() => {
    chrome.storage.local.get("login_status", (item) => {
        if (item.login_status) {
            chrome.alarms.create("refresh_alarm", {periodInMinutes: TOKEN_REFRESH_TIME});
        }
    });
});

/**
 * Event that fires when an alarm fires.
 */
chrome.alarms.onAlarm.addListener((alarm) => {
    // When the refresh alarm rings, refresh the access token.
    if (alarm.name == "refresh_alarm") {
        spotifyRefreshToken();
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
        url: DOMAIN_BACKEND + "/api/spotify/login/",
        interactive: true
    }, (redirectURI) => {
        // Parse the URL query parameters into a JSON.
        let queryParameters = queryURLToJSON(redirectURI);

        // Store the tokens into storage.
        chrome.cookies.set({"httpOnly": true, "name": "access_token", "url": DOMAIN_COOKIE_STORE, "value": queryParameters.access_token});
        chrome.cookies.set({"httpOnly": true, "name": "refresh_token", "url": DOMAIN_COOKIE_STORE, "value": queryParameters.refresh_token});
        chrome.storage.local.set({"login_status": true});

        // Set an alarm to refresh the access token periodically.
        chrome.alarms.create("refresh_alarm", {periodInMinutes: TOKEN_REFRESH_TIME});

        // Open the redirect page to show the user that they have successfully connected their Spotify account.
        window.open(DOMAIN_EXTENSION + "/redirect.html");
    });
}

/**
 * Refresh the access token using the refresh token.
 */
function spotifyRefreshToken() {
    chrome.cookies.get({"name": "refresh_token", "url": DOMAIN_COOKIE_STORE}, (cookie) => {
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
    });
}

/**
 * Removes access and refresh token keys from chrome.storage and changes login status in chrome.storage.
 */
function spotifyLogout() {
    chrome.cookies.remove({"name": "access_token", "url": DOMAIN_BACKEND});
    chrome.cookies.remove({"name": "refresh_token", "url": DOMAIN_BACKEND});
    chrome.storage.local.set({"login_status": false});
    chrome.alarms.clear("refresh_alarm");
}

/*--------------------------------------------------------------------------*/
/* HELPER FUNCTIONS */
/*--------------------------------------------------------------------------*/

// Takes as parameter a URL and returns a JSON of the extracted query parameters.
function queryURLToJSON(string) {
    return JSON.parse('{"' + decodeURI(string.split('?')[1].replace(/&/g, "\",\"").replace(/=/g,"\":\"")) + '"}');
}