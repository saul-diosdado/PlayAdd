/**
 * File: login.js
 * Purpose: Handles the login button and changing the popup if the user logged in.
 */

let spotifyLoginButton = document.getElementById("spotify-login-button");

// Tell the background.js script to start the login process when user hits "login".
spotifyLoginButton.addEventListener("click", () => {
    setLoadingAnimation();
    chrome.runtime.sendMessage({message: "login"}, (response) => {
        if (!response.success) {
            // The login failed, therefore the login popup is still showing so remove the loading animation.
            removeLoadingAnimation();
        }
    });
});

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