var openid = require('openid');
var passport = require('passport');
var OpenidStrategy = require('passport-openid').Strategy;
var pg = require('pg');
var request = require('request');
var winston = require('winston');

var config = require('./config');

module.exports = function(app, address, port, db_url) {
    var steamStrategy = new OpenidStrategy({
            providerURL: 'http://steamcommunity.com/openid',
            stateless: true,
            returnURL: 'http://' + address + ':' + port + '/auth/return',
            realm: 'http://' + address + ':' + port
        },
        function validate(identifier, done) {
            winston.debug("Validated user: ", identifier);
            pg.connect(db_url, function(err, client, pgdone) {
                if (err) {
                    return winston.error("Error fetching client from pool", err);
                }
                var query = "SELECT * FROM users WHERE openid_identifier=$1";
                client.query(query, [identifier], function(err, result) {
                    if (err) {
                        return winston.error("Error running query", err);
                    }
                    var steamid = identifier.match(/\d+$/)[0];
                    getSteamUsernameFromId(steamid, function(err, name) {
                        var points;
                        if (result.rows.length == 0) {
                            winston.debug("User doesn't exist, creating: ", identifier);
                            var query =
                                "INSERT INTO users (openid_identifier, name, steamid, points) " +
                                "VALUES ($1, $2, $3, $4)";
                            points = 0;
                            var parameters = [identifier, name, steamid, points];
                            client.query(query, parameters, function(err) {
                                if (err) {
                                    return winston.error("Error running query", err);
                                }
                                winston.info("Created user: ", name);
                            });
                        } else {
                            winston.debug("Found user: ", identifier);
                            points = result.rows[0].points
                        }
                        pgdone();
                        var user = {
                            identifier: identifier,
                            steamId: steamid,
                            name: name,
                            points: points
                        };
                        return done(null, user);
                    });
                });
            });
        });

    passport.use(steamStrategy);
    passport.serializeUser(passportSeralize);
    passport.deserializeUser(passportDeserialize);

    app.use(passport.initialize());
    app.use(passport.session());


    app.get('/auth', passport.authenticate('openid'));

    app.get('/auth/return', passport.authenticate('openid'),
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

function passportSeralize(user, done) {
    winston.debug("Serialized user:", user.name);
    done(null, user.identifier);
}

function passportDeserialize(identifier, done) {
    // TODO get rid of this ugly global by modularizing database connects
    winston.debug("Deserializing user:", identifier);
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

function getSteamUsernameFromId(id, callback) {
    var url = 'http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/' +
        '?key=' + config['steamAPI_key'] +
        '&steamids=' + id;
    request.get(url, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            winston.debug(body);
            var name = JSON.parse(body)['response']['players'][0]['personaname'];
            callback(null, name);
        } else {
            winston.error("Couldn't fetch Steam username: " + response.statusCode);
            callback(new Error(response.statusCode));
        }
    });
}