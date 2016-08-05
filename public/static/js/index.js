var socket = io();

$(document).ready(function() {
    $('#startChannel').click(function() {
        console.debug('Start channel');
        socket.emit('start channel');
    });
});

socket.on('channel valid', function(channel) {
    window.location.href = '/channel/' + channel;
});
