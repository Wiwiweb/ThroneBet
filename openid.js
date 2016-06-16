var openid = require('openid');
var passport = require('passport');
var SteamStrategy = require('passport-steam').Strategy;
var request = require('request');
var winston = require('winston');

var config = require('./config');
var db = require('./db');

module.exports = function(app, address, port) {
    var steamStrategy = new SteamStrategy({
            returnURL: 'http://' + address + ':' + port + '/auth/return',
            realm: 'http://' + address + ':' + port,
            apiKey: config['steamAPI_key']
        },
        function validate(identifier, profile, done) {
            winston.debug("Validated user:", profile);
            var query = "SELECT * FROM users WHERE openid_identifier=$1";
            db(query, [identifier]).then(function(result) {
                var steamid = profile.id;
                var points;
                if (result.rows.length == 0) {
                    winston.debug("User doesn't exist, creating:", profile.displayName);
                    var query =
                        "INSERT INTO users (openid_identifier, name, steamid, points) " +
                        "VALUES ($1, $2, $3, $4)";
                    points = 0;
                    var values = [identifier, profile.displayName, steamid, points];
                    // Can't chain promises because this is branching...
                    db(query, values).then(function() {
                        winston.info("Created user: ", profile.displayName);
                    }, function(err) {
                        winston.error("Error creating user:", err);
                        return done(err, null);
                    })
                } else {
                    winston.debug("Found user:", profile.displayName);
                    points = result.rows[0].points
                }
                var user = {
                    identifier: identifier,
                    steamId: steamid,
                    name: profile.displayName,
                    points: points
                };
                winston.debug("Done!");
                return done(null, user);
            }, function(err) {
                winston.error("Error fetching user:", err);
                return done(err, null);
            });
        });

    passport.use(steamStrategy);
    passport.serializeUser(passportSerialize);
    passport.deserializeUser(passportDeserialize);

    app.use(passport.initialize());
    app.use(passport.session());


    app.get('/auth', passport.authenticate('steam'));

    app.get('/auth/return', passport.authenticate('steam'),
        function(req, res) {
            if (req.user) {
                res.redirect('/?steamid=' + req.user.steamId);
            } else {
                res.redirect('/?failed');
            }
        });

    app.get('/auth/logout', function(req, res) {
        req.logout();
        res.redirect(request.get('Referer') || '/')
    });
};

function passportSerialize(user, done) {
    winston.debug("Serialized user:", user.name);
    done(null, user.identifier);
}

function passportDeserialize(identifier, done) {
    db("SELECT * FROM users WHERE openid_identifier=$1", [identifier]).then(function(result) {
        if (result.rows.length == 0) {
            done(winston.error("Couldn't find user", identifier));
            return;
        }
        winston.debug("Deserialized user:", result.rows[0].name);
        done(null, {
            identifier: identifier,
            steamId: result.rows[0].steamid,
            name: result.rows[0].name,
            points: result.rows[0].points
        });
    }, function(err) {
        done(winston.error("Error fetching user:", err));
    });
}
