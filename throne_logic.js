var socketio = require('socket.io');
var request = require('request');
var winston = require('winston');

var enemy = require('./enemyData');

var previousHealth = 0;

var userList = {}; // Dictionary of user id -> channel the user is in
var channelList = {}; // Dictionary of channel name -> channel object (contains key, list of users)
var channelDeletionTimeouts = {}; // Dictionary of channel name -> timeout reference (to make sure there's only one)

module.exports = function(http) {
    var io = socketio(http);
    io.on('connection', function (socket) {
        winston.log("User " + socket.id + " connected");
        socket.on('create channel', function (channel, key) {
            createChannel(socket, channel, key);
        });
        socket.on('check channel valid', function (channel) {
            if (channelList[channel]) {
                io.to(socket.id).emit('channel valid', channel);
            } else {
                io.to(socket.id).emit('error', "Channel does not exist!");
            }
        });
        socket.on('join channel', function (channel) {
            if (channelList[channel]) {
                addUserToChannel(socket, channel);
            } else {
                io.to(socket.id).emit('error', "Channel does not exist!");
            }
        });
        socket.on('disconnect', function () {
            winston.log("Disconnect event: " + socket.id)
        });
    });

    setInterval(mainLoop, 1000);
};


function mainLoop() {
    for (var channel in channelList) {
        if (channelList.hasOwnProperty(channel)) { // Necessary to avoid looping over prototype properties

            if (channelList[channel]['users'].length > 0) {
                if (channelDeletionTimeouts[channel]) {
                    winston.log("Channel " + channel + " no longer empty, cancelling timeout");
                    clearTimeout(channelDeletionTimeouts[channel]);
                    delete channelDeletionTimeouts[channel];
                }
                var data = getThroneData(channel, channelList[channel]['key'], function (error, channel, data) {
                    if (error) {
                        winston.error("Error fetching Throne data! code: " + error);
                        return;
                    }
                    sendEventNotifications(channel, data);
                });
            }
            else {
                if (!channelDeletionTimeouts[channel]) {
                    winston.log("Channel " + channel + " is now empty, removing in a minute");
                    channelDeletionTimeouts[channel] = setTimeout(deleteChannel.bind(this, channel), 60000);
                }
            }
        }
    }
}

function createChannel(socket, channel, key) {
    getThroneData(channel, key, function (error) {
        if (error) {
            winston.log("Channel " + channel + " could not be created, " + error);
            if (error.message == 403) {
                io.to(socket.id).emit('error', "Wrong key!");
            } else {
                io.to(socket.id).emit('error', "Unknown error!");
            }
            return;
        }
        winston.log("Creating channel " + channel);
        channelList[channel] = {'key': key, 'users': []};
        io.to(socket.id).emit('channel valid', channel);
    });
}

function deleteChannel(channel) {
    winston.log("Deleting channel " + channel);
    delete channelList[channel];
    delete channelDeletionTimeouts[channel];
}

function addUserToChannel(socket, channel) {
    var user = socket.id;
    winston.log("User " + user + " joined channel " + channel);
    userList[user] = channel;
    if (!channelList[channel]) {
        winston.error("Channel doesn't exist! (this shouldn't happen)");
    }
    socket.join(channel);
    channelList[channel]['users'].push(user);
    socket.on('disconnect', function () {
        disconnectUser(socket.id);
    });
    io.to(socket.id).emit('connected');
}

function disconnectUser(user) {
    winston.log("User " + user + " disconnected");
    var channel = userList[user];
    delete userList[user];
    if (!channelList[channel]) {
        winston.error("Channel doesn't exist! (this shouldn't happen)");
    }
    // Remove user from list
    channelList[channel]['users'].splice(channelList[channel]['users'].indexOf(user), 1);
}

function getThroneData(channel, key, callback) {
    winston.log("Checking data for channel " + channel);
    var url = 'https://tb-api.xyz/stream/get?s=' + channel + '&key=' + key;
    request.get(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            callback(null, channel, JSON.parse(body));
        } else {
            winston.log("Didn't work: " + response.statusCode);
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
