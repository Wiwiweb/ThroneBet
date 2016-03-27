var socket = io();

var urlParams = getUrlParameters();
console.info('urlParams: ', urlParams);
if ('s' in urlParams && 'key' in urlParams) {
    var channel = "s=" + urlParams['s'] + "&key=" + urlParams['key'];
    socket.emit('join channel', channel);
} else {
    console.warn("No channel!");
}

socket.on('hurt', function (msg) {
    $('#messages').append($('<li>').text("Hurt by a " + msg));
});
socket.on('dead', function (msg) {
    $('#messages').append($('<li>').html("<strong>Killed by a " + msg + "</strong>"));
});

// Source: http://stackoverflow.com/a/2880929/2510391
function getUrlParameters() {
    var match,
        pl = /\+/g,  // Regex for replacing addition symbol with a space
        search = /([^&=]+)=?([^&]*)/g,
        decode = function (s) {
            return decodeURIComponent(s.replace(pl, " "));
        },
        query = window.location.search.substring(1);

    var urlParams = {};
    while (match = search.exec(query))
        urlParams[decode(match[1])] = decode(match[2]);
    return urlParams;
}