/**
 * File: login.js
 * Purpose: Handles the login button and changing the popup if the user logged in.
 */

// Tell the background.js script to start the login process when user hits "login".
document.getElementById("login-button").addEventListener("click", () => {
    chrome.runtime.sendMessage({message: "login"});
});