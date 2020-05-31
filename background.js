// Matches any YouTube video URL (note the "/watch?")
const regex = /https:\/\/www\.youtube\.com\/watch\?\S*/gm;

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (regex.exec(changeInfo.url)) {
        console.log('You\'re watching a YouTube video!');
    }
});