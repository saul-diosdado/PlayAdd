/**
 * File: settings.js
 * Purpose: Script for settings page functionality.
 */

/**
 * Tell the background.js script to start the login process when user hits "login".
 */
document.getElementById("spotify-logout-button").addEventListener("click", () => {
    chrome.runtime.sendMessage({message: "logout"}, (response) => {});
});