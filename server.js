var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var request = require('request');
var enemy = require('./enemyData');

var server_port = process.env.OPENSHIFT_NODEJS_PORT || 8080;
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';

var previousHealth = 0;

var userList = {}; // Dictionary of user id -> channel the user is in
var channelList = {}; // Dictionary of channel name -> channel object (contains key, list of users)

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/client/index.html');
});

app.get('/channel/[a-z0-9]+', function(req, res) {
    res.sendFile(__dirname + '/client/channel.html');
});

app.get('/index.js', function(req, res) {
    res.sendFile(__dirname + '/client/index.js');
});

app.get('/channel/channel.js', function(req, res) {
    res.sendFile(__dirname + '/client/channel.js');
});

app.get('/main.css', function(req, res) {
    res.sendFile(__dirname + '/client/main.css');
});

io.on('connection', function(socket) {
    console.log("User " + socket.id + " connected");
    socket.on('create channel', function(channel, key) {
        createChannel(socket, channel, key);
    });
    socket.on('check channel valid', function(channel) {
        if (channelList[channel]) {
            io.to(socket.id).emit('channel valid', channel);
        } else {
            io.to(socket.id).emit('error', "Channel does not exist!");
        }
    });
    socket.on('join channel', function(channel) {
        if (channelList[channel]) {
            addUserToChannel(socket, channel);
        } else {
            io.to(socket.id).emit('error', "Channel does not exist!");
        }
    });
});

function createChannel(socket, channel, key) {
    getThroneData(channel, key, function(error, data) {
        if (error) {
            console.log("Channel " + channel + " could not be created, " + error);
            if (error.message == 403) {
                io.to(socket.id).emit('error', "Wrong channel and/or key!");
            } else {
                io.to(socket.id).emit('error', "Unknown error!");
            }
            return;
        }
        console.log("Creating channel " + channel);
        channelList[channel] = {'key': key, 'users': []};
        io.to(socket.id).emit('channel valid', channel);
    });
}

function addUserToChannel(socket, channel) {
    var user = socket.id;
    console.log("User " + user + " joined channel " + channel);
    userList[user] = channel;
    if (!channelList[channel]) {
        console.error("Channel doesn't exist! (this shouldn't happen)");
    }
    socket.join(channel);
    channelList[channel]['users'].push(user);
    socket.on('disconnect', function() {
        disconnectUser(socket.id)
    });
    io.to(socket.id).emit('connected');
}

function disconnectUser(user) {
    console.log("User " + user + " disconnected");
    var channel = userList[user];
    delete userList[user];
    if (!channelList[channel]) {
        console.error("Channel doesn't exist! (this shouldn't happen)");
    }
    // Remove user from list
    channelList[channel]['users'].splice(channelList[channel]['users'].indexOf(user), 1);

    if (channelList[channel]['users'].length == 0) {
        console.log("Channel " + channel + " is now empty, removing");
        delete channelList[channel];
    }
}


http.listen(server_port, server_ip_address, function() {
    console.log("Listening on http://" + server_ip_address + ":" + server_port)
});

setInterval(mainLoop, 1000);

function mainLoop() {
    for (var channel in channelList) {
        if (channelList.hasOwnProperty(channel)) { // Necessary to avoid looping over prototype properties
            var data = getThroneData(channel, channelList[channel]['key'], function(error, data) {
                if (error) {
                    console.error("Error fetching Throne data! code: " + error);
                    return;
                }
                sendEventNotifications(data);
            });
        }
    }
}

function getThroneData(channel, key, callback) {
    console.log("Checking data for channel " + channel);
    var url = 'https://tb-api.xyz/stream/get?s=' + channel + '&key=' + key;
    request.get(url, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            callback(null, JSON.parse(body));
        } else {
            console.log("Didn't work: " + response.statusCode);
            callback(new Error(response.statusCode));
        }
    });
}

function sendEventNotifications(data) {
    if (data['current'] != null) {
        var currentLastHit = data['current']['lasthit'];
        console.info("currentLastHit: " + currentLastHit);
        if (data['current']['health'] < previousHealth) {
            console.info("hurt: " + enemy[currentLastHit]);
            io.to(channel).emit('hurt', enemy[currentLastHit])
        }
        previousHealth = data['current']['health']
    } else if (data['previous'] != null
        && data['previous']['health'] == 0
        && data['previous']['health'] < previousHealth) {
        previousHealth = 0;
        var previousLastHit = data['previous']['lasthit'];
        console.info("dead: " + enemy[previousLastHit]);
        io.to(channel).emit('dead', enemy[previousLastHit])
    }
}