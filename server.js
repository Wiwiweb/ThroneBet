var ejs = require('ejs');
var app = require('express')();
var session = require('express-session');
var http = require('http').Server(app);

var openid = require('./openid');
var throneLogic = require('./throne_logic');

var config;

try {
    config = require('./secrets');
}
catch (err) {
    console.error("Unable to read secrets config file", err);
    process.exit(1);
}

var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
var server_port = process.env.OPENSHIFT_NODEJS_PORT || 4000;

app.use(session({
    secret: config['session_secret'],
    resave: false,
    saveUninitialized: true
}));

// Set up openID routes and callbacks
openid(app, server_ip_address, server_port);

app.set('view engine', 'ejs');

app.get('/', function(req, res) {
    console.log('req:', req.user);
    res.render(__dirname + '/client/index.ejs', {
        user: req.user
    });
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

app.get('/images/:file', function(req, res) {
    res.sendFile(__dirname + '/client/images/' + req.params.file);
});


http.listen(server_port, server_ip_address, function() {
    console.log("Listening on http://" + server_ip_address + ":" + server_port)
});

// Set socket connections and throne logic main loop
throneLogic(http);
