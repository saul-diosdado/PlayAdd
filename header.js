/*
    File: header.js
    Purpose: General purpose script for adding actions to buttons on the header bar,
        mainly the settings buttons.
*/

/*--------------------------------------------------------------------------*/
/* CONSTANTS */
/*--------------------------------------------------------------------------*/

const EXTENSION_ID = "lbaglokofickglbhmfkaimnafhghohhh";

// Open the settings page.
document.getElementById("settings-button").addEventListener("click", () => {
    window.open("chrome-extension://" + EXTENSION_ID + "/settings.html");
});