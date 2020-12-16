/**
 * File: settings.js
 * Purpose: Script for settings page functionality.
 */

/*--------------------------------------------------------------------------*/
/* HTML ELEMENTS */
/*--------------------------------------------------------------------------*/

const spotifyLoginStatusElement = document.getElementById("login-status-text");
const spotifyEmailElement = document.getElementById("spotify-email-text");
const spotifyButtonElement = document.getElementById("spotify-button");

/**
 * When this script is first ran, set the UI based on the login status of the user.
 */
chrome.storage.local.get("login_status", (item) => {
    if (item.login_status) {
        setUIUserIsLoggedIn();
    } else {
        setUIUserIsLoggedOut();
    }
});

/**
 * Continuously monitor changes to login status and change UI based on it. 
 */
chrome.storage.onChanged.addListener((changes, namespace) => {
    for (key in changes) {
        if (key === "login_status") {
            // If the user is now logged in.
            if (changes.login_status.newValue) {
                setUIUserIsLoggedIn();
            } else {
                setUIUserIsLoggedOut();
            }
        }
    }
});

/**
 * Tell the background.js script to start the login process or to logout the user, depending
 * on the current login status of the user.
 */
spotifyButtonElement.addEventListener("click", () => {
    // Get the current login status of the user from chrome.storage.
    chrome.storage.local.get("login_status", (item) => {
        // This button logs the user out if they are logged in, and vice versa.
        if (item.login_status) {
            chrome.runtime.sendMessage({message: "logout"});
        } else {
            chrome.runtime.sendMessage({message: "login"});
        }
    })
});

/**
 * Changes to the UI that need to be made when the user is currently logged in to Spotify.
 */
function setUIUserIsLoggedIn() {
    spotifyLoginStatusElement.innerText = "Yes";
    spotifyButtonElement.innerText = "Logout of Spotify";
}

/**
 * Changes to the UI that need to be made when the user is not logged in to Spotify.
 */
function setUIUserIsLoggedOut() {
    spotifyLoginStatusElement.innerText = "No";
    spotifyButtonElement.innerText = "Connect to Spotify";
}