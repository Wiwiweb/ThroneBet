var socket = io();

$(document).ready(function() {

    $('#createChannelForm').submit(function() {
        console.debug('Create channel');
        socket.emit('create channel', $('#createChannelInput').val(), $('#createKeyInput').val());
        return false;
    });
});


socket.on('throneError', function(msg) {
    alert(msg);
});

socket.on('channel valid', function(channel) {
    window.location.href = '/channel/' + channel;
});
