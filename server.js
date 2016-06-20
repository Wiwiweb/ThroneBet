var dateFormat = require('dateformat');
var ejs = require('ejs');
var app = require('express')();
var session = require('express-session');
var pgSession = require('connect-pg-simple')(session);
var pg = require('pg');
var http = require('http').Server(app);
var winston = require('winston');

var config = require('./config');
var db = require('./db');
var openid = require('./openid');
var throneLogic = require('./throneLogic');

winston.remove(winston.transports.Console);
if (process.argv[2] == 'debug') {
    winston.add(winston.transports.Console, {
        'timestamp': function() {
            return dateFormat(new Date());
        }, 'colorize': true,
        level: 'debug'
    });
    winston.debug("--- Starting in debug mode ---");
    db("TRUNCATE session");
} else {
    winston.add(winston.transports.Console, {
        'timestamp': function() {
            return dateFormat(new Date());
        }, 'colorize': true
    });
}

var serverIpAddress = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
var serverPort = process.env.OPENSHIFT_NODEJS_PORT || 4000;

var sessionStore = new pgSession({
    conString: db.dbUrl
});
var configuredSession = session({
    pg: pg,
    store: sessionStore,
    secret: config['session_secret'],
    resave: false,
    saveUninitialized: true
});
module.exports.configuredSession = configuredSession;
module.exports.sessionStore = sessionStore;

app.use(configuredSession);

// Set up openID routes and callbacks
openid(app, serverIpAddress, serverPort);

app.set('view engine', 'ejs');

app.get('/', function(req, res) {
        winston.debug("User is", req.user);
        if (req.user) {
            res.render(__dirname + '/public/index.ejs', {
                user: req.user.name,
                steamId: req.user.steamId
            });
        } else {
            res.render(__dirname + '/public/index.ejs', {
                user: null
            });
        }
    }
);

app.get('/channel/[a-z0-9]+', function(req, res) {
    res.sendFile(__dirname + '/public/channel.html');
});

app.get('/index.js', function(req, res) {
    res.sendFile(__dirname + '/public/index.js');
});

app.get('/channel/channel.js', function(req, res) {
    res.sendFile(__dirname + '/public/channel.js');
});

app.get('/main.css', function(req, res) {
    res.sendFile(__dirname + '/public/main.css');
});

app.get('/images/:file', function(req, res) {
    res.sendFile(__dirname + '/public/images/' + req.params.file);
});


http.listen(serverPort, serverIpAddress, function() {
    winston.info("Listening on http://" + serverIpAddress + ":" + serverPort);
});

// Set socket connections and throne logic main loop
throneLogic(http);
