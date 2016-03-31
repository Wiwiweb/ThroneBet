var socket = io();

$(document).ready(function() {

    $('#createChannelForm').submit(function(event) {
        console.debug('Create channel');
        socket.emit('create channel', $('#createChannelInput').val(), $('#createKeyInput').val());
        return false;
    });

    $('#joinChannelForm').submit(function(event) {
        console.debug('Join channel');
        socket.emit('check channel valid', $('#joinChannelInput').val());
        return false;
    });
});


socket.on('error', function(msg) {
    alert(msg);
});

socket.on('channel valid', function(channel) {
    window.location.href = '/channel/' + channel;
});