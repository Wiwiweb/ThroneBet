var passport = require('passport');
var SteamStrategy = require('passport-steam').Strategy;
var DummyStrategy = require('passport-dummy').Strategy;
var winston = require('winston');

var config = require('./config');
var db = require('./db');
var anonNames = require('../data/anonNames');

module.exports = function(app, address, port) {
    var steamStrategy = new SteamStrategy({
            returnURL: 'http://' + address + ':' + port + '/auth/return',
            realm: 'http://' + address + ':' + port,
            apiKey: config['steamAPI_key']
        },
        function validate(identifier, profile, done) {
            winston.debug("Validated user:", profile);

            var user = {
                openidIdentifier: identifier,
                steamId: steamid,
                name: profile.displayName
            };
            return done(null, user);
        }
    );

    // Could be replaced with just req.logIn(),
    // but it makes it nicer to have this here as a strategy
    var dummyStrategy = new DummyStrategy(function validate(done) {
            var name = getAnonName();
            var user = {
                openidIdentifier: null,
                steamId: null,
                name: name
            };
            return done(null, user);
        }
    );

    passport.use(steamStrategy);
    passport.use(dummyStrategy);
    passport.serializeUser(passportSerialize);
    passport.deserializeUser(passportDeserialize);

    app.use(passport.initialize());
    app.use(passport.session());


    app.get('/auth', passport.authenticate('steam'));

    app.get('/auth/return', passport.authenticate('steam'),
        function(req, res) {
            res.redirect('/');
        });

    app.get('/auth/logout', function(req, res) {
        req.logout();
        res.redirect(req.get('Referer') || '/')
    });
};

function passportSerialize(user, done) {
    // The passport user is a simple object with no secrets
    // It can be entirely included inside the cookie
    done(null, user);
}

function passportDeserialize(identifier, done) {
    done(null, identifier)
}

function getAnonName() {
    var randomPart = "";
    for (var i = 0; i < 3; i++) {
        randomPart += anonNames[Math.floor(Math.random() * anonNames.length)];
    }
    return 'Anon_' + randomPart;
}
