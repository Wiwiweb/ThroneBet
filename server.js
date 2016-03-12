var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var request = require('request');
var enemy = require('./enemyData');

var server_port = process.env.OPENSHIFT_NODEJS_PORT || 8080;
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';

var previousHealth = 0;

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', function (socket) {
    console.log('a user connected');
    socket.on('disconnect', function () {
        console.log('user disconnected');
    });
});


http.listen(server_port, server_ip_address, function () {
    console.log("Listening on " + server_ip_address + ", server_port " + server_port)
});

setInterval(getThroneData, 1000);

function getThroneData() {
    request.get(wiwi, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var info = JSON.parse(body);
            if (info['current'] != null) {
                var currentLastHit = info['current']['lasthit'];
                console.info("currentLastHit: " + currentLastHit);
                if (info['current']['health'] < previousHealth) {
                    console.info("hurt: " + enemy[currentLastHit]);
                    io.emit('hurt', enemy[currentLastHit])
                }
                previousHealth = info['current']['health']
            } else if (info['previous'] != null
                && info['previous']['health'] == 0
                && info['previous']['health'] < previousHealth) {
                previousHealth = 0;
                var previousLastHit = info['previous']['lasthit'];
                console.info("dead: " + enemy[previousLastHit]);
                io.emit('dead', enemy[previousLastHit])
            }
        }
    });
}

function getEnemy(int) {
    return enemy[int]
}