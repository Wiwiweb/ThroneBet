/*
 Handles creation and deletion of channels, as well as redirecting sockets to them
 */

var winston = require('winston');

var io;
var channelsBySteamId: {};
//var engine = module.exports;

function initialize(ioVar) {
    io = ioVar; // io comes from socketio(http);
}

function createChannel() {

}

function deleteChannel(channel) {
    winston.info("Deleting channel %s", channel.name);
    delete channelsBySteamId[channel.steamId];
}

module.exports.initialize = initialize;
module.exports.createChannel = createChannel;
module.exports.deleteChannel = deleteChannel;
