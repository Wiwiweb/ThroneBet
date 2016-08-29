var winston = require('winston');

module.exports = class Channel {

    constructor(name, steamId, key) {
        this.name = name;
        this.steamId = steamId;
        this.key = key;
        this.listSockets = [];
        this.usersByAuthId = {}
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
        listSockets.push(socket);
        winston.debug("Channel %s added socket: %s", this.name, socket.user.name);
    }

    removeSocket(socket) {
        if (this.usersByAuthId[socket.user.authId]) {
            winston.error("Channel %s tried to remove socket belonging to no one: %s", this.name, socket);
            return;
        }

        var userSockets = socket.user.sockets;
        userSockets.splice(userSockets.indexOf(socket, 1)); // Remove socket from the user list of sockets
        listSockets.splice(listSockets.indexOf(socket, 1)); // Remove socket from the channel list of sockets

        if (userSockets.length == 0) {
            // This user is no longer in the channel
            delete this.usersByAuthId[socket.request.user.authId];
        }
        winston.debug("Channel %s removed socket: %s", this.name, socket);
        // TODO: Do stuff if channel empty (set timer then delete channel)
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
};
