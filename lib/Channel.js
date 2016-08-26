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
        user.sockets.push(socket)
    }

    removeSocket(socket) {
        if (this.usersByAuthId[socket.request.user.authId]) {
            winston.error("Channel %s tried to remove socket belonging to no one: %s", this.name, socket);
            return;
        }

        var userSockets = socket.user.sockets;
        userSockets.splice(userSockets.indexOf(socket, 1)); // Remove socket from list

        if (userSockets.length == 0) {
            // This user is no longer in the channel
            delete this.usersByAuthId[socket.request.user.authId];
        }
        // Do stuff if channel empty
    }

    // Create a channel user from the passport user
    createUser(passportUser) {
        user = {
            sockets: [],
            name: passportUser.name
        };
        return user;
    }
};
