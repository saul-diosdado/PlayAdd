// Matches any YouTube video URL (note the "/watch?")
const regexYTVideoURL = /https:\/\/www\.youtube\.com\/watch\?\S*/gm;

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
        // User hit "login" button.
        if (request.message == "login") {
            // Launch the "Authorization Code Flow", handle the response with the callback function.
            chrome.identity.launchWebAuthFlow({
                url: "http://localhost:3000/api/spotify/login/",
                interactive: true
            }, (redirectURI) => {
                // Parse the URL query parameters into a JSON.
                let queryParameters = queryURLToJSON(redirectURI);

                // Store the tokens into storage.
                chrome.storage.local.set({"access-token": queryParameters.access_token}, () => {
                    console.log("Access token stored!");
                });
                chrome.storage.local.set({"refresh-token": queryParameters.refresh_token}, () => {
                    console.log("Refresh token stored!");
                });
            });
            
            // Response indicating successful login.
            sendResponse({message: "success"});
        }
    }
);

/*--------------------------------------------------------------------------*/
/* HELPER FUNCTIONS */
/*--------------------------------------------------------------------------*/

// Takes as parameter a URL and returns a JSON of the extracted query parameters.
function queryURLToJSON(string) {
    return JSON.parse('{"' + decodeURI(string.split('?')[1].replace(/&/g, "\",\"").replace(/=/g,"\":\"")) + '"}');
}