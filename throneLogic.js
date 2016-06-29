var cookieParser = require('cookie-parser');
var socketio = require('socket.io');
var session = require('express-session');
var passportSocketIo = require('passport.socketio');
var request = require('request');
var winston = require('winston');

var config = require('./config');
var server = require('./server');
var User = require('./user');
var deaths = require('./data/deathsAPIData');
var bets = require('./data/betsData');

var io;
var deathToBets;

var previousHealth = 0;

var userList = {}; // Dictionary of user socketId -> user object
var channelList = {}; // Dictionary of channel name -> channel object (contains key, list of users)
var channelDeletionTimeouts = {}; // Dictionary of channel name -> timeout reference (to make sure there's only one)

module.exports = function(http) {

    deathToBets = buildInvertedBetsMap();
    io = socketio(http);
    io.use(passportSocketIo.authorize({
        store: server.sessionStore,
        secret: config['session_secret'],
        cookieParser: cookieParser
    }));
    io.on('connection', function(socket) {
        winston.info("User socket connected: ", socket.request.user);
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
        socket.on('place bet', function(betTarget) {
            winston.debug(socket.request.user.name + " placed a bet:", betTarget);
            placeBet(socket, betTarget);
        });
    });

    setInterval(mainLoop, 1000);
};

// betsData.json is a Bet -> Deaths map, which is human-readable
// But it's more efficient to have a Death -> Bets map to lookup which bets won
// Creating this map is costly but is a one-time operation
function buildInvertedBetsMap() {
    // In this case, an array is an acceptable substitute for an int -> string map
    deathToBets = [];
    for (var bet in bets) {
        if (bets.hasOwnProperty(bet)) {
            bets[bet].forEach(function(death) {
                if (deathToBets[death]) { // If it already exists, push extra bet value
                    deathToBets[death].push(bet);
                } else { // Otherwise create the array of bets
                    deathToBets[death] = [bet];
                }
            });
        }
    }
    winston.debug("Inverted bet map: \n", deathToBets);
}


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
    var userObject = new User(user.name, user.steamId, user.identifier, user.points, channel, socket.id);
    userList[id] = userObject;
    if (!channelList[channel]) {
        winston.error("Channel doesn't exist! (this shouldn't happen)");
    }
    socket.join(channel);
    channelList[channel]['users'].push(userObject);
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
    channelList[channel]['users'].splice(channelList[channel]['users'].indexOf(userList[userId]), 1);
}

function getThroneData(channel, key, callback) {
    winston.silly("Checking data for channel " + channel);
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

function placeBet(socket, betTarget) {
    var user = userList[socket.id];
    user.currentBets[betTarget] = 1;
}

function sendEventNotifications(channel, data) {
    if (data['current'] != null) {
        var currentLastHit = data['current']['lasthit'];
        winston.info("currentLastHit: " + currentLastHit);
        if (data['current']['health'] < previousHealth) {
            winston.info("hurt: " + deaths[currentLastHit]);
            io.to(channel).emit('hurt', deaths[currentLastHit])
        }
        previousHealth = data['current']['health']
    } else if (data['previous'] != null
        && data['previous']['health'] == 0
        && data['previous']['health'] < previousHealth) {
        previousHealth = 0;
        var previousLastHit = data['previous']['lasthit'];
        winston.info("Channel " + channel + " died from:", deaths[previousLastHit]);
        awardPoints(channel, deathToBets[previousLastHit]);
        io.to(channel).emit('dead', deaths[previousLastHit])
    }
}

function awardPoints(channel, winningBets) {
    var users = channelList[channel]['users'];
    users.forEach(function(user) {
        if (user.currentBets) {
            winningBets.forEach(function(winningBet) {
                if (user.currentBets[winningBet]) {
                    user.points++;
                    winston.info(user.name + " got a point");
                    io.to(user.socketId).emit('gain points', 1)
                }
            });
        }
    });
}
