// Matches any YouTube video URL (note the "/watch?")
const regexYTVideoURL = /https:\/\/www\.youtube\.com\/watch\?\S*/gm;
// Matches access granted/denied after Spotify Web Authrorization redirect
const regexAccessGranted = /http:\/\/localhost:8888\/callback#access_token=*/gm;
const regexAccessDenied = /http:\/\/localhost:8888\/callback\?error=access_denied/gm;

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

    // Check if user was redirected to local host and verify if access was granted or denied.
    if (regexAccessGranted.exec(changeInfo.url)) {
        // Contains access_token, expires_in, and token_type.
        let responseJSON = queryGrantedStringToJSON(changeInfo.url);
        chrome.storage.local.set({"accessToken": responseJSON.access_token}, () => {
            console.log("accessToken set.");
        });

        // Alert the user of succesful authorization.
        alert("Access granted for " + responseJSON.expires_in + " seconds!");

        // Set the popup to the content html popup and set state to logged in.
        chrome.storage.local.set({"isLoggedIn": true}, () => {
            chrome.browserAction.setPopup({popup: "holder.html"});
            console.log("Logged in.")
        });
    } else if (regexAccessDenied.exec(changeInfo.url)) {
        alert("Access denied!");
    }
});

// Clears all local storage once the Chrome window is closed.
chrome.windows.onRemoved.addListener(function(windowid) {
    chrome.storage.local.clear(() => {
        console.log("Local storage cleared.")
    });
})

// Convert an access granted URL hash fragment to a JSON.
function queryGrantedStringToJSON(string) {
    return JSON.parse('{"' + decodeURI(string.split('#')[1].replace(/&/g, "\",\"").replace(/=/g,"\":\"")) + '"}')
}