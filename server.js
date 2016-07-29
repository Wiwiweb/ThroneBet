var dateFormat = require('dateformat');
var ejs = require('ejs');
var express = require('express');
var favicon = require('serve-favicon');
var app = express();
var session = require('express-session');
var pgSession = require('connect-pg-simple')(session);
var pg = require('pg');
var passport = require('passport');
var http = require('http').Server(app);
var winston = require('winston');

var config = require('./config');
var db = require('./db');
var openid = require('./openid');
var throneLogic = require('./throneLogic');
var zonesData = require('./data/zonesData');

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

app.use(favicon(__dirname + '/public/static/images/favicon.png'));
app.use(express.static(__dirname + '/public/static'));

// Set up openID routes and callbacks
openid(app, serverIpAddress, serverPort);

app.set('view engine', 'ejs');

app.get('/', function(req, res) {
    winston.debug("User is", req.user);
    var user = null;
    if (req.user && !req.user.anonymous) {
        user = req.user;
    }
    res.render(__dirname + '/public/index.ejs', {
        user: user,
        channelList: throneLogic.channelList
    });
});

app.get('/create-channel', function(req, res) {
    winston.debug("User is", req.user);
    var user = null;
    if (req.user && !req.user.anonymous) {
        user = req.user;
    }
    res.render(__dirname + '/public/create-channel.ejs', {
        user: user
    });
});

app.get('/channel/[a-z0-9]+',
    function(req, res, next) {
        winston.debug("Channel init login:", req.user);
        if (req.isUnauthenticated()) {
            passport.authenticate('dummy', function(err, user) {
                if (err) {
                    return next(err);
                }
                req.logIn(user, function(err) {
                    if (err) {
                        return next(err);
                    }
                })
            })(req, res, next);
        }
        next();
    },
    function(req, res) {
        winston.debug("Channel login:", req.user);
        res.render(__dirname + '/public/channel.ejs', {
            zones: zonesData
        });
    }
);

http.listen(serverPort, serverIpAddress, function() {
    winston.info("Listening on http://" + serverIpAddress + ":" + serverPort);
});

// Set socket connections and throne logic main loop
throneLogic(http);
