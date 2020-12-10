/*
    File: background.js
    Purpose: Script runs in the background and listens to messages.
*/

/*--------------------------------------------------------------------------*/
/* CONSTANTS */
/*--------------------------------------------------------------------------*/

// Matches any YouTube video URL (note the "/watch?")
const regexYTVideoURL = /https:\/\/www\.youtube\.com\/watch\?\S*/gm;

const DOMAIN_BACKEND = "http://localhost:3000";

// Chrome.storage.local keys.
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

// Listens to changes in browser URL.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Check if a YouTube video is being watched.
    chrome.tabs.query({active: true, lastFocusedWindow: true}, (tabs) => {
        if (regexYTVideoURL.exec(tabs[0].url) || regexYTVideoURL.exec(tab.url)) {
            console.log("Watching a YouTube video!");
            
            // Check the login state of the user and set the popup accordingly.
            chrome.storage.local.get("isLoggedIn", (item) => {
                if (item.isLoggedIn) {
                    chrome.browserAction.setPopup({tabId: tabId, popup: "popup.html"});
                } else {
                    chrome.browserAction.setPopup({tabId: tabId, popup: "login.html"});
                }
            });
        } else {
            // If a YouTube video is not being watched and the user is logged in, show the holder popup.
            chrome.storage.local.get("isLoggedIn", (item) => {
                if (item.isLoggedIn) {
                    chrome.browserAction.setPopup({tabId: tabId, popup: "holder.html"});
                }
            });
        }
    });
});

// Listen to messages.
chrome.runtime.onMessage.addListener(
    (request, sender, sendResponse) => {
        if (request.message == "login") {
            spotifyLoginAuthorization();
            sendResponse({message: "success"});
        } else if (request.message == "refresh") {
            spotifyRefreshToken();
            sendResponse({message: "success"});
        }
    }
);

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
        chrome.storage.local.set({ACCESS_TOKEN_KEY: queryParameters.access_token}, () => {
            console.log("Access token stored!");
        });
        chrome.storage.local.set({REFRESH_TOKEN_KEY: queryParameters.refresh_token}, () => {
            console.log("Refresh token stored!");
        });
    });
}

/**
 * Refresh the access token using the refresh token.
 */
function spotifyRefreshToken() {
    chrome.storage.local.get(REFRESH_TOKEN_KEY, (item) => {
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

                console.log(response);

                // Store the tokens into storage.
                chrome.storage.local.set({ACCESS_TOKEN_KEY: response.access_token}, () => {
                    console.log("Access token stored!");
                });
                // Sometimes we will also get a new refresh token from Spotify, if so store the new refresh token.
                if (response.hasOwnProperty("refresh_token")) {
                    chrome.storage.local.set({REFRESH_TOKEN_KEY: response.refresh_token}, () => {
                        console.log("Refresh token stored!");
                    });
                }
            }
        }
        xmlHTTP.send();
    });
}

/*--------------------------------------------------------------------------*/
/* HELPER FUNCTIONS */
/*--------------------------------------------------------------------------*/

// Takes as parameter a URL and returns a JSON of the extracted query parameters.
function queryURLToJSON(string) {
    return JSON.parse('{"' + decodeURI(string.split('?')[1].replace(/&/g, "\",\"").replace(/=/g,"\":\"")) + '"}');
}