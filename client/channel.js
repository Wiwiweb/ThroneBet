var socket = io();

var channel = window.location.pathname.split('/')[2];

socket.emit('join channel', channel);

socket.on('connected', function() {
    $('#messages').append($('<li>').text("Connected to channel " + channel));
    document.title = "ThroneBet - " + channel;
});

socket.on('hurt', function(msg) {
    $('#messages').append($('<li>').text("Hurt by a " + msg));
});

socket.on('dead', function(msg) {
    $('#messages').append($('<li>').html("<strong>Killed by a " + msg + "</strong>"));
});

socket.on('error', function(msg) {
    alert(msg);
});
