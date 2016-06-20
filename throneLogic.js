var cookieParser = require('cookie-parser');
var socketio = require('socket.io');
var session = require('express-session');
var passportSocketIo = require("passport.socketio");
var request = require('request');
var winston = require('winston');

var config = require('./config');
var enemy = require('./enemyData');
var server = require('./server');
var User = require('./user');

var io;

var previousHealth = 0;

var userList = {}; // Dictionary of user id -> user object
var channelList = {}; // Dictionary of channel name -> channel object (contains key, list of users)
var channelDeletionTimeouts = {}; // Dictionary of channel name -> timeout reference (to make sure there's only one)

module.exports = function(http) {
    io = socketio(http);
    io.use(passportSocketIo.authorize({
        store: server.sessionStore,
        secret: config['session_secret'],
        cookieParser: cookieParser
    }));
    io.on('connection', function(socket) {
        winston.info("User connected: ", socket.request.user);
        socket.on('create channel', function(channel, key) {
            winston.debug("create channel", channel, key);
            createChannel(socket, channel, key);
        });
        socket.on('check channel valid', function(channel) {
            if (channelList[channel]) {
                io.to(socket.id).emit('channel valid', channel);
            } else {
                io.to(socket.id).emit('throneError', "Channel does not exist!");
            }
        });
        socket.on('join channel', function(channel) {
            if (channelList[channel]) {
                addUserToChannel(socket, channel);
            } else {
                io.to(socket.id).emit('throneError', "Channel does not exist!");
            }
        });
        socket.on('disconnect', function() {
            winston.debug("Disconnect event: " + socket.id)
        });
    });

    setInterval(mainLoop, 1000);
};


function mainLoop() {
    for (var channel in channelList) {
        if (channelList.hasOwnProperty(channel)) { // Necessary to avoid looping over prototype properties

            if (channelList[channel]['users'].length > 0) {
                if (channelDeletionTimeouts[channel]) {
                    winston.info("Channel " + channel + " no longer empty, cancelling timeout");
                    clearTimeout(channelDeletionTimeouts[channel]);
                    delete channelDeletionTimeouts[channel];
                }
                var data = getThroneData(channel, channelList[channel]['key'], function(err, channel, data) {
                    if (err) {
                        winston.error("Error fetching Throne data! code: " + err);
                        return;
                    }
                    sendEventNotifications(channel, data);
                });
            }
            else {
                if (!channelDeletionTimeouts[channel]) {
                    winston.info("Channel " + channel + " is now empty, removing in a minute");
                    channelDeletionTimeouts[channel] = setTimeout(deleteChannel.bind(this, channel), 60000);
                }
            }
        }
    }
}

function createChannel(socket, channel, key) {
    // Check if channel is correct
    // We don't actually care about the data, just that it returns OK
    getThroneData(channel, key, function(err) {
        if (err) {
            winston.warn("Channel " + channel + " could not be created:", err);
            if (err.message == 403) {
                io.to(socket.id).emit('throneError', "Wrong key!");
            } else {
                io.to(socket.id).emit('throneError', "Unknown error!");
            }
            return;
        }
        winston.info("Creating channel:", channel);
        channelList[channel] = {'key': key, 'users': []};
        io.to(socket.id).emit('channel valid', channel);
    });
}

function deleteChannel(channel) {
    winston.info("Deleting channel " + channel);
    delete channelList[channel];
    delete channelDeletionTimeouts[channel];
}

function addUserToChannel(socket, channel) {
    var user = socket.request.user;
    var id = socket.id;
    winston.verbose("User " + user.name + " joined channel " + channel);
    userList[id] = new User(user.name, user.steamId, user.identifier, user.points, channel);
    if (!channelList[channel]) {
        winston.error("Channel doesn't exist! (this shouldn't happen)");
    }
    socket.join(channel);
    channelList[channel]['users'].push(user);
    socket.on('disconnect', function() {
        disconnectUser(socket.id);
    });
    io.to(socket.id).emit('connected');
}

function disconnectUser(userId) {
    winston.verbose("User " + userList[userId].name + " disconnected");
    var channel = userList[userId].channel;
    delete userList[userId];
    if (!channelList[channel]) {
        winston.error("Channel doesn't exist! (this shouldn't happen)");
    }
    // Remove user from list
    channelList[channel]['users'].splice(channelList[channel]['users'].indexOf(userId), 1);
}

function getThroneData(channel, key, callback) {
    winston.debug("Checking data for channel " + channel);
    var url = 'https://tb-api.xyz/stream/get?s=' + channel + '&key=' + key;
    request.get(url, function(err, response, body) {
        if (!err && response.statusCode == 200) {
            callback(null, channel, JSON.parse(body));
        } else {
            winston.error("Didn't work: " + response.statusCode);
            callback(new Error(response.statusCode));
        }
    });
}

function sendEventNotifications(channel, data) {
    if (data['current'] != null) {
        var currentLastHit = data['current']['lasthit'];
        winston.info("currentLastHit: " + currentLastHit);
        if (data['current']['health'] < previousHealth) {
            winston.info("hurt: " + enemy[currentLastHit]);
            io.to(channel).emit('hurt', enemy[currentLastHit])
        }
        previousHealth = data['current']['health']
    } else if (data['previous'] != null
        && data['previous']['health'] == 0
        && data['previous']['health'] < previousHealth) {
        previousHealth = 0;
        var previousLastHit = data['previous']['lasthit'];
        winston.info("dead: " + enemy[previousLastHit]);
        io.to(channel).emit('dead', enemy[previousLastHit])
    }
}
