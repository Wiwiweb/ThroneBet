var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var request = require('request');
var enemy = require('./enemyData');

var server_port = process.env.OPENSHIFT_NODEJS_PORT || 8080;
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';

var previousHealth = 0;

var userList = {}; // Dictionary of user id -> channel the user is in
var channelList = {}; // Dictionary of channels -> list of users in channel

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

app.get('/client.js', function (req, res) {
    res.sendFile(__dirname + '/client.js');
});

io.on('connection', function (socket) {
    console.log("User " + socket.id + " connected");
    socket.on('join channel', function (channel) {
        addUserToChannel(socket, channel);
        socket.on('disconnect', function () {
            disconnectUser(socket.id)
        });
    });
});

function addUserToChannel(socket, channel) {
    var user = socket.id;
    console.log("User " + user + " joined channel " + channel);
    userList[user] = channel;
    if (!channelList[channel]) {
        console.log('Creating channel ' + channel);
        channelList[channel] = [];
        socket.join(channel)
    }
    channelList[channel].push(user)
}

function disconnectUser(user) {
    console.log("User " + user + " disconnected");
    var channel = userList[user];
    delete userList[user];
    channelList[channel].splice(channelList[channel].indexOf(user), 1); // Remove user from list

    if (channelList[channel].length == 0) {
        console.log("Channel " + channel + " is now empty, removing");
        delete channelList[channel];
    }
}


http.listen(server_port, server_ip_address, function () {
    console.log("Listening on http://" + server_ip_address + ":" + server_port)
});

setInterval(mainLoop, 1000);

function mainLoop() {
    for (var channel in channelList) {
        if (channelList.hasOwnProperty(channel)) { // Necessary to avoid looping over prototype properties
            getThroneData(channel)
        }
    }
}

function getThroneData(channel) {
    console.log("Checking data for channel " + channel);
    var url = 'https://tb-api.xyz/stream/get?' + channel;
    request.get(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var info = JSON.parse(body);
            if (info['current'] != null) {
                var currentLastHit = info['current']['lasthit'];
                console.info("currentLastHit: " + currentLastHit);
                if (info['current']['health'] < previousHealth) {
                    console.info("hurt: " + enemy[currentLastHit]);
                    io.to(channel).emit('hurt', enemy[currentLastHit])
                }
                previousHealth = info['current']['health']
            } else if (info['previous'] != null
                && info['previous']['health'] == 0
                && info['previous']['health'] < previousHealth) {
                previousHealth = 0;
                var previousLastHit = info['previous']['lasthit'];
                console.info("dead: " + enemy[previousLastHit]);
                io.to(channel).emit('dead', enemy[previousLastHit])
            }
        }
    });
}