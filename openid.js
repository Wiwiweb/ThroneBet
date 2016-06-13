var openid = require('openid');
var passport = require('passport');
var SteamStrategy = require('passport-steam').Strategy;
var pg = require('pg');
var request = require('request');
var winston = require('winston');

var config = require('./config');

module.exports = function(app, address, port, db_url) {
    var steamStrategy = new SteamStrategy({
            returnURL: 'http://' + address + ':' + port + '/auth/return',
            realm: 'http://' + address + ':' + port,
            apiKey: config['steamAPI_key']
        },
        function validate(identifier, profile, done) {
            winston.debug("Validated user:", profile);
            pg.connect(db_url, function(err, client, pgdone) {
                if (err) {
                    return winston.error("Error fetching client from pool", err);
                }
                var query = "SELECT * FROM users WHERE openid_identifier=$1";
                client.query(query, [identifier], function(err, result) {
                    if (err) {
                        return winston.error("Error running query", err);
                    }
                    var steamid = profile.id;
                    var points;
                    if (result.rows.length == 0) {
                        winston.debug("User doesn't exist, creating:", profile.displayName);
                        var query =
                            "INSERT INTO users (openid_identifier, name, steamid, points) " +
                            "VALUES ($1, $2, $3, $4)";
                        points = 0;
                        var parameters = [identifier, profile.displayName, steamid, points];
                        client.query(query, parameters, function(err) {
                            if (err) {
                                return winston.error("Error running query", err);
                            }
                            winston.info("Created user: ", profile.displayName);
                        });
                    } else {
                        winston.debug("Found user: ", profile.displayName);
                        points = result.rows[0].points
                    }
                    pgdone();
                    var user = {
                        identifier: identifier,
                        steamId: steamid,
                        name: profile.displayName,
                        points: points
                    };
                    return done(null, user);
                });
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
    // TODO get rid of this ugly global by modularizing database connects
    pg.connect(db_url, function(err, client, pgdone) {
        if (err) {
            winston.error("Error fetching client from pool", err);
            done(err);
            return;
        }
        client.query("SELECT * FROM users WHERE openid_identifier=$1", [identifier], function(err, result) {
            pgdone();
            if (err) {
                winston.error("Error running query", err);
                done(err);
                return;
            }
            if (result.rows.length == 0) {
                winston.error("Couldn't find user", identifier);
                done(err);
                return;
            }
            winston.debug("Deserialized user:", result.rows[0].name);
            done(null, {
                identifier: identifier,
                steamId: result.rows[0].steamid,
                name: result.rows[0].name,
                points: result.rows[0].points
            });
        });
    });
}
