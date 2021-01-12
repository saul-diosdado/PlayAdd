/**
 * File: settings.js
 * Purpose: Script for settings page functionality.
 */

/*--------------------------------------------------------------------------*/
/* HTML ELEMENTS */
/*--------------------------------------------------------------------------*/

const spotifyLoginStatusText = document.getElementById("spotify-login-status-text");
const spotifyEmailText = document.getElementById("spotify-email-text");
const spotifyLoginButton = document.getElementById("spotify-login-button");

const extensionVersionElement = document.getElementById("extension-version-text");

/*--------------------------------------------------------------------------*/
/* CONSTANTS/GLOBAL VARIABLES */
/*--------------------------------------------------------------------------*/

const DOMAIN_BACKEND = "https://playadd-for-spotify.herokuapp.com";
const DOMAIN_COOKIE_STORE = "https://playadd-for-spotify.herokuapp.com";

/**
 * Tell the background.js script to start the login process or to logout the user, depending
 * on the current login status of the user.
 */
spotifyLoginButton.addEventListener("click", () => {
    // Get the current login status of the user from chrome.storage.
    chrome.storage.local.get("isLoggedIn", (item) => {
        // This button logs the user out if they are logged in, and vice versa.
        if (item.isLoggedIn) {
            chrome.runtime.sendMessage({message: "logout"});
        } else {
            setLoadingAnimation();
            chrome.runtime.sendMessage({message: "login"}, (response) => {
                if (!response.success) {
                    // The login failed, therefore the login popup is still showing so remove the loading animation.
                    removeLoadingAnimation();
                }
            });
        }
    })
});


/**
 * When this script is first ran, set the UI based on the login status of the user.
 */
chrome.storage.local.get("isLoggedIn", (item) => {
    if (item.isLoggedIn) {
        setUIUserIsLoggedIn();
    } else {
        setUIUserIsLoggedOut();
    }
});

// When the script is first ran, display the version number of the extension.
extensionVersionElement.innerText = chrome.runtime.getManifest().version;

/**
 * Continuously monitor changes to login status and change UI based on it. 
 */
chrome.storage.onChanged.addListener((changes, namespace) => {
    for (key in changes) {
        if (key === "isLoggedIn") {
            // If the user is now logged in.
            if (changes.isLoggedIn.newValue) {
                setUIUserIsLoggedIn();
            } else {
                setUIUserIsLoggedOut();
            }
        }
    }
});

/**
 * Changes to the UI that need to be made when the user is currently logged in to Spotify.
 */
function setUIUserIsLoggedIn() {
    spotifyLoginStatusText.innerText = "Yes";
    spotifyLoginButton.innerText = "Logout of Spotify";
    chrome.storage.local.get("userEmail", (item) => {
        if (item.userEmail != null) {
            spotifyEmailText.innerText = item.userEmail;
        } else {
            // Make an API request to get the user's email, update the UI, and store the email.
            spotifyGetEmail((email) => {
                spotifyEmailText.innerText = email;
                chrome.storage.local.set({userEmail: email});
            });
        }
    });
}

/**
 * Changes to the UI that need to be made when the user is not logged in to Spotify.
 */
function setUIUserIsLoggedOut() {
    spotifyLoginStatusText.innerText = "No";
    spotifyLoginButton.innerText = "Connect to Spotify";
    spotifyEmailText.innerText = "N/A";
}

/**
 * Creates and adds a loading animation to the login button.
 */
function setLoadingAnimation() {
    let loadingCircle = document.createElement("i");
    loadingCircle.className = "fa fa-circle-o-notch fa-spin";
    spotifyLoginButton.innerText = " Connecting";
    spotifyLoginButton.insertBefore(loadingCircle, spotifyLoginButton.firstChild);
}

/**
 * Resets the login button to its original state.
 */
function removeLoadingAnimation() {
    spotifyLoginButton.removeChild(spotifyLoginButton.firstChild);
    spotifyLoginButton.innerText = "Connect to Spotify";
}

/**
 * Makes an API request to Spotify to retrieve the Spotify profile of the user.
 * When the response is received, update the UI with the email.
 * @param {function} callback Function that updates the UI given the email.
 */
function spotifyGetEmail(callback) {
    const profileEndpoint = "https://api.spotify.com/v1/me";

    chrome.cookies.get({"name": "accessToken", "url": DOMAIN_COOKIE_STORE}, (cookie) => {
        let xmlHTTP = new XMLHttpRequest();
        xmlHTTP.open("GET", profileEndpoint, true);
        xmlHTTP.setRequestHeader("Authorization", "Bearer " + cookie.value);
        xmlHTTP.onreadystatechange = () => {
            if (xmlHTTP.readyState === 4 && xmlHTTP.status === 200) {
                let userObject = JSON.parse(xmlHTTP.response);
                // Update the email UI field with the user's email.
                callback(userObject.email);
            }
        }
        xmlHTTP.send();
    });
}