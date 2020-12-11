/*
    File: background.js
    Purpose: Script runs in the background and listens to messages.
*/

/*--------------------------------------------------------------------------*/
/* CONSTANTS */
/*--------------------------------------------------------------------------*/

// Matches any YouTube video URL (note the "/watch?")
const regexYTVideoURL = new RegExp("https:\/\/www\.youtube\.com\/watch\?\S*");

const DOMAIN_BACKEND = "http://localhost:3000";
const EXTENSION_ID = "lbaglokofickglbhmfkaimnafhghohhh";

/**
 * Event listener that fires when a Google Chrome window is opened.
 */
chrome.windows.onCreated.addListener((window) => {
    // Check if the user is logged in. If so, don't show the login popup and refersh the access token.
    chrome.storage.local.get("login_status", (item) => {
        if (item.login_status) {
            chrome.browserAction.setPopup({popup: "popup.html"});
            spotifyRefreshToken();
        }
    });
});

/**
 * Event listener that monitors changes to chrome.storage keys.
 */
chrome.storage.onChanged.addListener((changes, namespace) => {
    for (key in changes) {
        // Monitor changes to login status. Change the popup accordingly.
        if (key == "login_status") {
            if (changes.login_status) {
                chrome.browserAction.setPopup({popup: "popup.html"});
            } else {
                chrome.browserAction.setPopup({popup: "login.html"});
            }
        }
    }
});

/**
 * Listens to changes in browser URL.
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status == "complete") {
        chrome.storage.local.set({"is_watching_yt_video": regexYTVideoURL.test(tab.url)});
    }
});

/**
 * Listens to messages from other scripts.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.message == "login") {
            spotifyLoginAuthorization();
            sendResponse({message: "success"});
        } else if (request.message == "refresh") {
            spotifyRefreshToken();
            sendResponse({message: "success"});
        } else if (request.message == "logout") {
            spotifyLogout();
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
        chrome.storage.local.set({"access_token": queryParameters.access_token}, () => {
            console.log("Access token stored.");
        });
        chrome.storage.local.set({"refresh_token": queryParameters.refresh_token}, () => {
            console.log("Refresh token stored.");
        });
        chrome.storage.local.set({"login_status": true}, () => {
            console.log("Logged in.")
        });

        // Open the redirect page to show the user that they have successfully connected their Spotify account.
        window.open("chrome-extension://" + EXTENSION_ID + "/redirect.html");
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
                chrome.storage.local.set({"access_token": response.access_token}, () => {
                    console.log("Refreshed access token stored.");
                });
                // Sometimes we will also get a new refresh token from Spotify. If so, store the new refresh token.
                if (response.hasOwnProperty("refresh_token")) {
                    chrome.storage.local.set({"refresh_token": response.refresh_token}, () => {
                        console.log("Refreshed refresh token stored.");
                    });
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
    chrome.storage.local.remove(["access_token", "refresh_token"], () => {
        console.log("Erased tokens.")
    });
    chrome.storage.local.set({"login_status": false}, () => {
        console.log("Logged out.");
    });
}

/*--------------------------------------------------------------------------*/
/* HELPER FUNCTIONS */
/*--------------------------------------------------------------------------*/

// Takes as parameter a URL and returns a JSON of the extracted query parameters.
function queryURLToJSON(string) {
    return JSON.parse('{"' + decodeURI(string.split('?')[1].replace(/&/g, "\",\"").replace(/=/g,"\":\"")) + '"}');
}