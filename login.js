// Tell the background.js script to start the login process when user hits "login".
document.getElementById("login-button").addEventListener("click", () => {
    chrome.runtime.sendMessage({message: "login"}, (response) => {
        // Handle response.
        if (response.message == "success") {
            // Set the login status to true and change the extension popup.
            chrome.storage.local.set({"isLoggedIn": true}, () => {
                chrome.browserAction.setPopup({popup: "holder.html"});
            });
        } else if (response.message == "fail") {
            alert("Error: Could not connect to Spotify!");
        }
    });
});