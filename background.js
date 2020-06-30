// Matches any YouTube video URL (note the "/watch?")
const regexYTVideoURL = /https:\/\/www\.youtube\.com\/watch\?\S*/gm;
// Matches access granted/denied after Spotify Web Authrorization redirect
const regexAccessGranted = /http:\/\/localhost:8888\/callback#access_token=*/gm;
const regexAccessDenied = /http:\/\/localhost:8888\/callback\?error=access_denied/gm;

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

// Listens to changes in browser URL.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Check if a YouTube video is being watched.
    if (regexYTVideoURL.exec(changeInfo.url)) {
        console.log("Watching a YouTube video!");
        chrome.runtime.onMessage.addListener((message, callback) => {
            if (message == "changeColor"){
                chrome.tabs.executeScript({
                    code: console.log('Hello')
                });
            }
        });
        
        // Song title
        // console.log(document.querySelector("#collapsible > ytd-metadata-row-renderer:nth-child(4)").querySelector("#content > yt-formatted-string").textContent);
        // Artist
        // console.log(document.querySelector("#collapsible > ytd-metadata-row-renderer:nth-child(5)").querySelector("#content > yt-formatted-string").textContent);
        // Artist (with hyperlink)
        // console.log(document.querySelector("#collapsible > ytd-metadata-row-renderer:nth-child(5)").querySelector("#content > yt-formatted-string").querySelector("#content > yt-formatted-string > a").textContent);
    }

    // Check if user was redirected to local host and verify if access was granted or denied.
    if (regexAccessGranted.exec(changeInfo.url)) {
        // Contains access_token, expires_in, and token_type.
        let responseJSON = queryGrantedStringToJSON(changeInfo.url);
        chrome.storage.local.set({"accessToken": responseJSON.access_token}, () => {
            console.log("accessToken set.");
        });
        // Alert the user of succesful authorization.
        alert("Access granted for " + responseJSON.expires_in + " seconds!");
    } else if (regexAccessDenied.exec(changeInfo.url)) {
        alert("Access denied!");
    }
});

// Convert an access granted URL hash fragment to a JSON.
function queryGrantedStringToJSON(string) {
    return JSON.parse('{"' + decodeURI(string.split('#')[1].replace(/&/g, "\",\"").replace(/=/g,"\":\"")) + '"}')
}