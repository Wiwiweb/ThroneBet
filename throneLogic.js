var cookieParser = require('cookie-parser');
var socketio = require('socket.io');
var session = require('express-session');
var passportSocketIo = require('passport.socketio');
var request = require('request');
var winston = require('winston');

var config = require('./config');
var db = require('./db');
var server = require('./server');
var User = require('./classes/userClass');
var Channel = require('./classes/channelClass');
var deaths = require('./data/deathsAPIData');
var bets = require('./data/betsData');

var io;
var deathToBets;

var previousHealth = 0;

// Dictionary of user openidIdentifier -> user object
var userList = {};

// Dictionary of channel name -> channel object (contains key, list of users)
var channelList = new Map();

// Dictionary of channel name -> timeout reference (to make sure there's only one)
var channelDeletionTimeouts = {};

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
            if (channelList.get(channel)) {
                io.to(socket.id).emit('channel valid', channel);
            } else {
                io.to(socket.id).emit('throneError', "Channel does not exist!");
            }
        });
        socket.on('join channel', function(channel) {
            if (channelList.get(channel)) {
                addUserToChannel(socket, channel);
            } else {
                io.to(socket.id).emit('throneError', "Channel does not exist!");
            }
        });
        socket.on('place bet', function(betTarget) {
            winston.debug(socket.request.user.name + " placed a bet:", betTarget);
            placeBet(socket.request.user.openidIdentifier, betTarget);
        });
    });

    setInterval(mainLoop, 1000);
};

module.exports.channelList = channelList;


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
}


function mainLoop() {
    for (var channel of channelList.values()) {
        var channelId = channel.steamId;
        if (channel['users'].length > 0) {
            if (channelDeletionTimeouts[channelId]) {
                winston.info("Channel " + channel.creator + " no longer empty, cancelling timeout");
                clearTimeout(channelDeletionTimeouts[channelId]);
                delete channelDeletionTimeouts[channelId];
            }
            var data = getThroneData(channelId, channel['key'], function(err, channel, data) {
                if (err) {
                    winston.error("Error fetching Throne data! code: " + err);
                    return;
                }
                sendEventNotifications(channel.steamId, data);
            });
        }
        else {
            if (!channelDeletionTimeouts[channelId]) {
                winston.info("Channel " + channel.creator + " is now empty, removing in a minute");
                channelDeletionTimeouts[channelId] = setTimeout(deleteChannel.bind(this, channelId), 60000);
            }
        }
    }
}

function createChannel(socket, channelId, key) {
    // Check if channel is correct
    // We don't actually care about the data, just that it returns OK
    getThroneData(channelId, key, function(err) {
        if (err) {
            winston.warn("Channel " + channelId + " could not be created:", err);
            if (err.message == 403) {
                io.to(socket.id).emit('throneError', "Wrong key!");
            } else {
                io.to(socket.id).emit('throneError', "Unknown error!");
            }
            return;
        }
        winston.info("Creating channel:", socket.request.user.name);
        channelList.set(channelId, new Channel(channelId, key, socket.request.user.name));
        io.to(socket.id).emit('channel valid', channelId);
    });
}

function deleteChannel(channel) {
    winston.info("Deleting channel " + channel);
    delete channelList.get(channel);
    delete channelDeletionTimeouts[channel];
}

function addUserToChannel(socket, channel) {
    var user = socket.request.user;
    winston.verbose("User " + user.name + " joined channel " + channel);
    var userObject = new User(user.id, user.name, user.steamId, user.openidIdentifier, user.points, channel, socket.id);
    userList[user.openidIdentifier] = userObject;
    if (!channelList.get(channel)) {
        winston.error("Channel doesn't exist! (this shouldn't happen)");
    }
    socket.join(channel);
    channelList.get(channel)['users'].push(userObject);
    socket.on('disconnect', function() {
        disconnectUser(user.openidIdentifier);
    });
    io.to(socket.id).emit('connected');
}

function disconnectUser(userId) {
    winston.verbose("User " + userList[userId].name + " disconnected");
    var channel = userList[userId].channel;
    delete userList[userId];
    if (!channelList.get(channel)) {
        winston.error("Channel doesn't exist! (this shouldn't happen)");
    }
    // Remove user from list
    channelList.get(channel)['users'].splice(channelList.get(channel)['users'].indexOf(userList[userId]), 1);
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

function placeBet(userId, betTarget) {
    var user = userList[userId];
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
        var winners = calculatePoints(channel, deathToBets[previousLastHit]);
        awardPoints(channel, winners);
        io.to(channel).emit('dead', deaths[previousLastHit])
    }
}

function calculatePoints(channel, winningBets) {
    var winners = {};
    var users = channelList.get(channel)['users'];
    users.forEach(function(user) {
        if (user.currentBets) {
            winningBets.forEach(function(winningBet) {
                if (user.currentBets[winningBet]) {
                    var earned = user.currentBets[winningBet];
                    // This is where more complicated calculations involving odds and time will happen in the future
                    if (winners[user.openidIdentifier]) { // If the user is already a winner, just add more points
                        winners[user.openidIdentifier] += earned;
                    } else {
                        winners[user.openidIdentifier] = earned;
                    }
                    winston.info(user.name + " earned " + earned + " points");
                }
            });
        }
    });
    return winners;
}

function awardPoints(channel, winners) {
    for (var winner in winners) {
        if (winners.hasOwnProperty(winner)) {
            var user = userList[winner];
            var points = winners[winner];
            io.to(channel).emit('points awarded', user.name, points);
            user.points += points;
            db("UPDATE users SET points=$1 WHERE openid_identifier=$2", [user.points, user.identifier]);
            winston.info(user.name + " earned a total of " + points + " points and now has " + user.points);
        }
    }
}
