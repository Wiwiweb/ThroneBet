/*
 Class that handles user logic for a single channel
 */

var winston = require('winston');
var engine = require('./channelEngine');

var DELETE_TIMEOUT = 60000;

module.exports = class Channel {

    constructor(steamId, name, key) {
        this.steamId = steamId; // SteamId will be the ID of the channel, since it has to be unique
        this.name = name;
        this.key = key;
        this.listSockets = [];
        this.channelUsersByAuthId = {};
        this.selfDestructTimeout = null;
    }

    addSocket(socket) {
        var channelUser = this.channelUsersByAuthId[socket.request.user.authId];
        if (!channelUser) {
            // This is a socket from someone new
            channelUser = this.createChannelUser(socket.request.user);
            this.channelUsersByAuthId[socket.request.user.authId] = channelUser;
        }

        socket.channelUser = channelUser;
        channelUser.sockets.push(socket);
        this.listSockets.push(socket);
        winston.debug("Channel %s added socket: %s", this.name, socket.channelUser.name);
        if (this.selfDestructTimeout) {
            clearTimeout(this.selfDestructTimeout);
            this.selfDestructTimeout = null;
            winston.debug("Channel %s cancelled self destruct", this.name);
        }
    }

    removeSocket(socket) {
        if (socket.channelUser == undefined || this.channelUsersByAuthId[socket.channelUser.authId]) {
            winston.error("Channel %s tried to remove socket belonging to no one: %s", this.name, socket);
            return;
        }

        var userSockets = socket.channelUser.sockets;
        userSockets.splice(userSockets.indexOf(socket, 1)); // Remove socket from the user list of sockets
        this.listSockets.splice(this.listSockets.indexOf(socket, 1)); // Remove socket from the channel list of sockets

        if (userSockets.length == 0) {
            // This user is no longer in the channel
            delete this.channelUsersByAuthId[socket.channelUser.authId];
        }
        winston.debug("Channel %s removed socket: %s", this.name, socket);
        if (this.channelUsersByAuthId.length == 0) {
            this.selfDestructTimeout = setTimeout(this.deleteChannel, DELETE_TIMEOUT);
            winston.debug("Channel %s has no users, started self destruct countdown", this.name);
        }
    }

    // Create a channel user from the passport user
    createChannelUser(passportUser) {
        var channelUser = {
            sockets: [],
            name: passportUser.name,
            authId: passportUser.authId
        };
        winston.debug("Channel %s created new channel user: %s", this.name, channelUser.name);
        return channelUser;
    }

    deleteChannel() {
        engine.deleteChannel(this);
    }
};
