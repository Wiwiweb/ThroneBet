/*
 Class that handles user logic for a single channel
 */

var winston = require('winston');

var DELETE_TIMEOUT = 60000;

module.exports = class Channel {

    constructor(engine, name, steamId, key) {
        this.engine = engine;
        this.name = name;
        this.steamId = steamId; // SteamId will be the ID of the channel, since it has to be unique
        this.key = key;
        this.listSockets = [];
        this.usersByAuthId = {};
        this.selfDestructTimeout = null;
    }

    addSocket(socket) {
        var user = this.usersByAuthId[socket.request.user.authId];
        if (!user) {
            // This is a socket from someone new
            user = this.createUser(socket.request.user);
            this.usersByAuthId[socket.request.user.authId] = user;
        }

        socket.user = user;
        user.sockets.push(socket);
        this.listSockets.push(socket);
        winston.debug("Channel %s added socket: %s", this.name, socket.user.name);
        if (this.selfDestructTimeout) {
            clearTimeout(this.selfDestructTimeout);
            this.selfDestructTimeout = null;
            winston.debug("Channel %s cancelled self destruct", this.name);
        }
    }

    removeSocket(socket) {
        if (this.usersByAuthId[socket.user.authId]) {
            winston.error("Channel %s tried to remove socket belonging to no one: %s", this.name, socket);
            return;
        }

        var userSockets = socket.user.sockets;
        userSockets.splice(userSockets.indexOf(socket, 1)); // Remove socket from the user list of sockets
        this.listSockets.splice(this.listSockets.indexOf(socket, 1)); // Remove socket from the channel list of sockets

        if (userSockets.length == 0) {
            // This user is no longer in the channel
            delete this.usersByAuthId[socket.request.user.authId];
        }
        winston.debug("Channel %s removed socket: %s", this.name, socket);
        if (this.usersByAuthId.length == 0) {
            this.selfDestructTimeout = setTimeout(this.deleteChannel, DELETE_TIMEOUT);
            winston.debug("Channel %s has no users, started self destruct countdown", this.name);
        }
    }

    // Create a channel user from the passport user
    createUser(passportUser) {
        user = {
            sockets: [],
            name: passportUser.name,
            authId: passportUser.authId
        };
        winston.debug("Channel %s created new user: %s", this.name, user.name);
        return user;
    }

    deleteChannel() {
        this.engine.deleteChannel(this);
    }
};
