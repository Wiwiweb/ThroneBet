var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var request = require('request');

var server_port = process.env.OPENSHIFT_NODEJS_PORT || 8080;
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';

var previousLastHit = 0;

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket) {
    console.log('a user connected');
    socket.on('disconnect', function() {
        console.log('user disconnected');
    });
});


http.listen(server_port, server_ip_address, function() {
    console.log("Listening on " + server_ip_address + ", server_port " + server_port)
});

setInterval(getThroneData, 1000);

function getThroneData() {
    var url = 'https://tb-api.xyz/stream/get?s=STEAM_0:0:10357287&key=CGKNPQTWY';
    request.get(url, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            var info = JSON.parse(body);
            if (info['current'] != null) {
                var currentLastHit = info['current']['lastHit'];
                if (currentLastHit == previousLastHit) {
                    if (info['current']['health'] == 0) {
                        console.info("dead: " + currentLastHit);
                        previousLastHit = 0;
                        io.emit('dead', currentLastHit);
                    } else {
                        console.info("hurt: " + currentLastHit);
                        previousLastHit = currentLastHit;
                        io.emit('hurt', currentLastHit)
                    }
                }
            }
        }
    });
}