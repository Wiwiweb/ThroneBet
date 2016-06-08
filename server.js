var dateFormat = require('dateformat');
var ejs = require('ejs');
var app = require('express')();
var session = require('express-session');
var pgSession = require('connect-pg-simple')(session);
var http = require('http').Server(app);
var request = require('request');
var winston = require('winston');

var openid = require('./openid');
var throneLogic = require('./throne_logic');

winston.remove(winston.transports.Console);
if (process.argv[2] == 'debug') {
    winston.add(winston.transports.Console, {
        'timestamp': function() {
            return dateFormat(new Date());
        }, 'colorize': true,
        level: 'debug'
    });
    winston.debug("--- Starting in debug mode ---")
} else {
    winston.add(winston.transports.Console, {
        'timestamp': function() {
            return dateFormat(new Date());
        }, 'colorize': true
    });
}

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
var db_url = process.env.OPENSHIFT_POSTGRESQL_DB_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';

app.use(session({
    store: new pgSession({
        conString: db_url
    }),
    secret: config['session_secret'],
    resave: false,
    saveUninitialized: true
}));

// Set up openID routes and callbacks
openid(app, server_ip_address, server_port);

app.set('view engine', 'ejs');

app.get('/', function(req, res) {
    winston.debug("User is", req.user);
    if (req.user) {
        getSteamUsernameFromId(req.user.steamId, function(error, name) {
            if (error) {
                res.render(__dirname + '/public/index.ejs', {
                    user: req.user.steamId
                });
            } else {
                res.render(__dirname + '/public/index.ejs', {
                    user: name
                });
            }
        });
    } else {
        res.render(__dirname + '/public/index.ejs', {
            user: null
        });
    }
});

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


http.listen(server_port, server_ip_address, function() {
    winston.info("Listening on http://" + server_ip_address + ":" + server_port);
});

// Set socket connections and throne logic main loop
throneLogic(http);


function getSteamUsernameFromId(id, callback) {
    var url = 'http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/' +
        '?key=' + config['steamAPI_key'] +
        '&steamids=' + id;
    request.get(url, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            var name = JSON.parse(body)['response']['players'][0]['personaname'];
            callback(null, name);
        } else {
            winston.error("Couldn't fetch Steam username: " + response.statusCode);
            callback(new Error(response.statusCode));
        }
    });

}
