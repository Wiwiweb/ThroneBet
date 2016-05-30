var openid = require('openid');
var passport = require('passport');
var OpenidStrategy = require('passport-openid').Strategy;
var winston = require('winston');

module.exports = function(app, address, port) {
    var steamStrategy = new OpenidStrategy({
            providerURL: 'http://steamcommunity.com/openid',
            stateless: true,
            returnURL: 'http://' + address + ':' + port + '/auth/return',
            realm: 'http://' + address + ':' + port
        },
        // "validate" callback
        function (identifier, done) {
            winston.log('user: ' + identifier);
            var user = {
                identifier: identifier,
                steamId: identifier.match(/\d+$/)[0]
            };
            return done(null, user);
        });

    passport.use(steamStrategy);
    passport.serializeUser(function (user, done) {
        done(null, user.identifier);
    });
    passport.deserializeUser(function (identifier, done) {
        // For this demo, we'll just return an object literal since our user
        // objects are this trivial.  In the real world, you'd probably fetch
        // your user object from your database here.
        done(null, {
            identifier: identifier,
            steamId: identifier.match(/\d+$/)[0]
        });
    });

    app.use(passport.initialize());
    app.use(passport.session());


    app.get('/auth', passport.authenticate('openid'));

    app.get('/auth/return', passport.authenticate('openid'),
        function (req, res) {
            if (req.user) {
                res.redirect('/?steamid=' + req.user.steamId);
            } else {
                res.redirect('/?failed');
            }
        });

    app.get('/auth/logout', function (req, res) {
        req.logout();
        res.redirect(request.get('Referer') || '/')
    });
};
