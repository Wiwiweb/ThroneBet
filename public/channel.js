var socket = io();

var channel = window.location.pathname.split('/')[2];

socket.emit('join channel', channel);

socket.on('connected', function() {
    addMessage("Connected to channel " + channel);
    document.title = "ThroneBet - " + channel;
});

socket.on('hurt', function(msg) {
    addMessage("Hurt by a " + msg);
});

socket.on('dead', function(msg) {
    addMessage("<strong>Killed by a " + msg + "</strong>");
});

socket.on('gain points', function(pointNb) {
    addMessage("<strong>You won " + pointNb + " points!</strong>");
});

socket.on('throneError', function(msg) {
    alert(msg);
});

$(document).ready(function() {
    $('.death').click(function() {
        addMessage("Betting on " + $(this).data('name'));
        socket.emit('place bet', $(this).data('name'));
    });

});

function addMessage(text) {
    $('#messages').append($('<li>').html(text));
}