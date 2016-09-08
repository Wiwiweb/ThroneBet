/*
 Handles creation and deletion of channels, as well as redirecting sockets to them
 */

var winston = require('winston');

var io;
var channelsBySteamId = {};

function initialize(ioVar) {
    io = ioVar; // io comes from socketio(http);
    io.on('connection', setupSocket);
}

function createChannel(channelSteamId) {
    // TODO: verify channel is in db
    // if yes: create it normally
    // if no: create it in uninitialized mode
}

function deleteChannel(channel) {
    winston.info("Deleting channel %s", channel.name);
    delete channelsBySteamId[channel.steamId];
}

function setupSocket(socket) {
    winston.debug("Socket %s connected", socket.request.user.name);

    socket.on('disconnect', function() {
        winston.debug("Socket %s disconnected", socket.request.user.name);
        if (socket.channel) {
            socket.channel.removeSocket(socket);
        }
    });

    socket.on('join channel', function(channelSteamId) {
        if (socket.channel) {
            winston.warning("Socket %s tried to join another channel", socket.request.user.name);
            return;
        }
        winston.debug("Socket %s joined channel %s", socket.request.user.name, channelSteamId);

        channel = channelsBySteamId[channelSteamId];
        if (!channel) {
            // This channel doesn't exist yet
            // If this is the owner, then create it
            if (socket.request.user.steamId == channelSteamId) {
                winston.info("Owner created channel %s", channelSteamId);
                createChannel(channelSteamId)
            } else {
                winston.warning("Socket %s tried to join non-existing channel", socket.request.user.name);
                return;
            }
        }
        socket.channel = channel;
    });
}

module.exports.initialize = initialize;
module.exports.createChannel = createChannel;
module.exports.deleteChannel = deleteChannel;
