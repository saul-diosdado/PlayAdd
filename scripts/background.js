/*
 * File: background.js
 * Purpose: Script runs in the background and listens to messages.
 */

/*--------------------------------------------------------------------------*/
/* CONSTANTS/GLOBAL VARIABLES */
/*--------------------------------------------------------------------------*/

// Matches any YouTube video URL (note the "/watch?")
const regexYTVideoURL = new RegExp("https:\/\/www\.youtube\.com\/watch\?\S*");

const DOMAIN_BACKEND = "http://localhost:3000";
const DOMAIN_COOKIE_STORE = "https://playadd-for-spotify.herokuapp.com";
const DOMAIN_EXTENSION = "chrome-extension://" + chrome.runtime.id;

// The time between refreshing the access token (45 minutes).
const TOKEN_REFRESH_TIME = 45 * 60 * 1000;
// Holds the interval object.
let tokenRefreshInterval = null;

/**
 * Check if the user is logged in. If so, go ahead and refresh the access token and
 * set the correct popup depending on the login status.
 * Note that this only happens when the background script is first ran like when a
 * new Google Chrome window is opened.
 */
chrome.storage.local.get("isLoggedIn", (item) => {
    if (item.isLoggedIn) {
        // Go ahead and refresh the token immediately.
        spotifyRefreshToken();
        // Interval to now periodically refresh the token.
        tokenRefreshInterval = setInterval(spotifyRefreshToken, TOKEN_REFRESH_TIME);
        // Set the correct popup for each tab since the user is logged in.
        chromeSetLoggedInPopups();
    } else {
        // Set a login popup for each tab.
        chromeSetLoggedOutPopups();
    }
});

/*--------------------------------------------------------------------------*/
/* CHROME API LISTENERS */
/*--------------------------------------------------------------------------*/

/**
 * Listens to messages from other scripts.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.message == "login") {
            spotifyLogin(sendResponse);
        } else if (request.message == "logout") {
            spotifyLogout();
        }

        return true;
    }
);

/**
 * Event listener that listens to changes in values stored in chrome.storage.
 */
chrome.storage.onChanged.addListener((changes) => {
    for (key in changes) {
        // Monitor changes to the login status of the user.
        if (key === "isLoggedIn") {
            // User logged in.
            if (changes.isLoggedIn.newValue) {
                chromeSetLoggedInPopups();
            } else {
                chromeSetLoggedOutPopups();
            }
        }
    }
});

/**
 * Event listener which fires upon any change to a tab.
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // The changeInfo object holds the values that have changed in the tab object when the user navigates to a new page.
    if (changeInfo.hasOwnProperty("url") && regexYTVideoURL.test(changeInfo.url)) {
        // The user is watching a YouTube video.
        chrome.storage.local.set({"isWatchingYTVideo": true});
    } else if (changeInfo.hasOwnProperty("url") && !regexYTVideoURL.test(changeInfo.url)) {
        // The user is NOT watching a YouTube video.
        chrome.storage.local.set({"isWatchingYTVideo": false});
        chrome.browserAction.setPopup({popup: "holder.html", tabId: tabId});
    }

    // The changeInfo object does not always have the "title" field, this avoids false negatives.
    if (changeInfo.hasOwnProperty("title")) {
        // If the user is watching a YouTube video, set the title and corresponding popups depending on login status.
        chrome.storage.local.get(["isWatchingYTVideo", "isLoggedIn"], (item) => {
            if (item.isWatchingYTVideo) {
                chrome.storage.local.set({"ytVideoTitle": changeInfo.title});
                if (item.isLoggedIn) {
                    chrome.browserAction.setPopup({popup: "popup.html", tabId: tabId});
                }
            }

            if (!item.isLoggedIn) {
                chrome.browserAction.setPopup({popup: "login.html", tabId: tabId});
            }
        })
    }
});

/*--------------------------------------------------------------------------*/
/* CHROME API HELPER FUNCTIONS */
/*--------------------------------------------------------------------------*/

/**
 * Iterate through each tab and set the correct popup depending on the URL of the tab.
 */
function chromeSetLoggedInPopups() {
    chrome.tabs.query({}, (tabs) => {
        for (tab of tabs) {
            if (regexYTVideoURL.test(tab.url)) {
                chrome.browserAction.setPopup({popup: "popup.html", tabId: tab.id});
                chrome.storage.local.set({"isWatchingYTVideo": true});
                chrome.storage.local.set({"ytVideoTitle": tab.title});
            } else {
                chrome.browserAction.setPopup({popup: "holder.html", tabId: tab.id});
            }
        }
    });
}

/**
 * Iterate through each open tab and set the popup to the login popup.
 */
function chromeSetLoggedOutPopups() {
    chrome.tabs.query({}, (tabs) => {
        for (tab of tabs) {
            chrome.browserAction.setPopup({popup: "login.html", tabId: tab.id});
        }
    });
}

/*--------------------------------------------------------------------------*/
/* SPOTIFY FUNCTIONS */
/*--------------------------------------------------------------------------*/

/**
 * Launch the "Authorization Code Flow", handle the response with the callback function.
 * @param {function} sendResponse Sends the script that started the login a response.
 */
function spotifyLogin(sendResponse) {
    chrome.identity.launchWebAuthFlow({
        url: DOMAIN_BACKEND + "/api/spotify/login/",
        interactive: true
    }, (redirectURI) => {
        if (chrome.runtime.lastError) {
            // Something went wrong, more than likely the user cancelled the login.
            sendResponse({success: false});
        } else {
            // Parse the URL query parameters into a JSON.
            let queryParameters = queryURLToJSON(redirectURI);
    
            // Store the tokens into storage.
            let expirationSeconds = getExpirationDateInSeconds();
            chrome.cookies.set({expirationDate: expirationSeconds, httpOnly: true, name: "accessToken", url: DOMAIN_COOKIE_STORE, value: queryParameters.access_token});
            chrome.cookies.set({expirationDate: expirationSeconds, httpOnly: true, name: "refreshToken", url: DOMAIN_COOKIE_STORE, value: queryParameters.refresh_token});
            chrome.storage.local.set({"isLoggedIn": true});
    
            // Set an interval to refresh the access token periodically.
            tokenRefreshInterval = setInterval(spotifyRefreshToken, TOKEN_REFRESH_TIME);
    
            // Open the redirect page to show the user that they have successfully connected their Spotify account.
            window.open(DOMAIN_EXTENSION + "/redirect.html");
    
            // Send the original script that started the login a response.
            sendResponse({success: true});
        }
    });
}

/**
 * Refresh the access token using the refresh token.
 */
function spotifyRefreshToken() {
    chrome.cookies.get({name: "refreshToken", url: DOMAIN_COOKIE_STORE}, (cookie) => {
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
    
                    let expirationSeconds = getExpirationDateInSeconds();
                    // Store the tokens into storage.
                    chrome.cookies.set({expirationDate: expirationSeconds, httpOnly: true, name: "accessToken", url: DOMAIN_COOKIE_STORE, value: response.access_token});
                    // Sometimes we will also get a new refresh token from Spotify. If so, store the new refresh token.
                    if (response.hasOwnProperty("refreshToken")) {
                        chrome.cookies.set({expirationDate: expirationSeconds, httpOnly: true, name: "refreshToken", url: DOMAIN_COOKIE_STORE, value: response.refresh_token});
                    }
                }
            }
            xmlHTTP.send();
        } catch (error) {
            // Most likely the extension failed to get the refersh token cookie. We logout the user in order to in a sense reset the extension.
            spotifyLogout();
        }
    });
}

/**
 * Removes access and refresh token keys from chrome.storage and changes login status in chrome.storage.
 */
function spotifyLogout() {
    chrome.cookies.remove({name: "accessToken", url: DOMAIN_BACKEND});
    chrome.cookies.remove({name: "refreshToken", url: DOMAIN_BACKEND});
    chrome.storage.local.set({isLoggedIn: false});
    chrome.storage.local.set({userEmail: null});
    chrome.identity.clearAllCachedAuthTokens(() => {});
    clearInterval(tokenRefreshInterval);
}

/*--------------------------------------------------------------------------*/
/* HELPER FUNCTIONS */
/*--------------------------------------------------------------------------*/

// Takes as parameter a URL and returns a JSON of the extracted query parameters.
function queryURLToJSON(string) {
    return JSON.parse('{"' + decodeURI(string.split('?')[1].replace(/&/g, "\",\"").replace(/=/g,"\":\"")) + '"}');
}

// Returns the seconds since the UNIX epoch 10 years from now.
function getExpirationDateInSeconds() {
    let date = new Date();
    let secondsSinceEpoch = date.getTime() / 1000;
    let tenYearsInSeconds = 315360000;
    return secondsSinceEpoch + tenYearsInSeconds;
}