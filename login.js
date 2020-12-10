/*
    File: login.js
    Purpose: Handles the login button and changing the popup if the user logged in.
*/

/*--------------------------------------------------------------------------*/
/* CONSTANTS */
/*--------------------------------------------------------------------------*/

// Tell the background.js script to start the login process when user hits "login".
document.getElementById("login-button").addEventListener("click", () => {
    chrome.runtime.sendMessage({message: "login"}, (response) => {
        // Change the extension popup if successful.
        if (response.message == "success") {
            chrome.browserAction.setPopup({popup: "popup.html"});
        }
    });
});