// Event listener on the login.html
document.addEventListener("DOMContentLoaded", () => {
    try {
        document.getElementById("login-button").addEventListener("click", implicitGrantLogin);
    } catch {}
});

// Redirect user to Spotify authorization screen with parameters.
function implicitGrantLogin() {
    // Parameters for authorization.
    const authEndpoint = "https://accounts.spotify.com/authorize";
    const clientID = "a1064fa27beb43a38664d07aa5405304";
    const responseType = "token";
    const redirectURI = "http://localhost:8888/callback";
    const scope = "playlist-modify-public playlist-modify-private playlist-read-private playlist-read-collaborative user-read-private user-read-email";

    // Full authorization URL with parameters.
    const authorizeURL = authEndpoint + 
            "?client_id=" + encodeURIComponent(clientID) + 
            "&response_type=" + responseType + 
            "&redirect_uri=" + encodeURIComponent(redirectURI) +
            "&scope=" + encodeURIComponent(scope);

    let xmlHTTP = new XMLHttpRequest();
    xmlHTTP.open("GET", authorizeURL, true);
    xmlHTTP.onreadystatechange = () => {
        if (xmlHTTP.status === 201) {
            chrome.pageAction.setPopup()
            alert(JSON.parse(xmlHTTP.responseText.access_token));
        }
    }
    xmlHTTP.send();

    window.open(authorizeURL, "_blank");
}