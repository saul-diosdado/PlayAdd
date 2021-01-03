/**
 * File: header.js
 * Purpose: General purpose script for adding actions to buttons on the header bar,
 * mainly the settings buttons.
 */

// Open the settings page.
document.getElementById("settings-button").addEventListener("click", () => {
    window.open("chrome-extension://" + chrome.runtime.id + "/settings.html");
});