
// Source: https://gist.github.com/DavidBruant/1016007
NodeList.      prototype.forEach = Array.prototype.forEach;
HTMLCollection.prototype.forEach = Array.prototype.forEach;

// Show the given text area
function ShowTextarea(name) {

    HideTextareas('.textarea');

    var ShowDiv = document.getElementById(name);

    if (ShowDiv != null)
        ShowDiv.style.display = "block";

}

// Hide a single text area
function HideTextarea(name) {

    var ShowDiv = document.getElementById(name);

    if (ShowDiv != null)
        ShowDiv.style.display = "none";

}

// Hide all matching text areas
function HideTextareas(name) {

    document.querySelectorAll(name).forEach(function (textarea) {
        textarea.style.display = "none";
    });

}