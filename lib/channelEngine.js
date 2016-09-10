/*
 Handles creation and deletion of channels, as well as redirecting sockets to them
 */

var winston = require('winston');
var Channel = require('./Channel');
var db = require('./db');

var io;
var channelsBySteamId = {};

function initialize(ioVar) {
    io = ioVar; // io comes from socketio(http);
    io.on('connection', setupSocket);
}

function createChannel(channelSteamId, name) {
    // TODO: verify channel is in db
    // if yes: create it normally
    // if no: return null (This shouldn't happen in normal use)
    db('SELECT * FROM channels WHERE steam_id=$1', [channelSteamId]).then(function(result) {
        if (result.rows.length == 0) {
            // We should redirect owner to channel creation page before that ever happens
            winston.error("Couldn't find channel", channelSteamId);
            return null;
        }
        return new Channel(channelSteamId, name, result.rows[0].key);
    });
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

        var channel = channelsBySteamId[channelSteamId];
        if (!channel) {
            // This channel doesn't exist yet
            // If this is the owner, then create it
            if (socket.request.user.steamId == channelSteamId) {
                winston.info("Owner created channel %s", channelSteamId);
                channel = createChannel(channelSteamId, socket.request.user.name);
                if (channel == null) {
                    winston.warning("Socket %s tried to create channel, but it was not in the database",
                        socket.request.user.name);
                    return;
                }
            } else {
                winston.warning("Socket %s tried to join non-existing channel", socket.request.user.name);
                return;
            }
        }

        winston.debug("Socket %s joined channel %s", socket.request.user.name, channelSteamId);
        socket.channel = channel;
        channel.addSocket(socket);
    });
}

module.exports.initialize = initialize;
module.exports.createChannel = createChannel;
module.exports.deleteChannel = deleteChannel;
