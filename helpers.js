var db = require('./db');

module.exports.getChannel = function(userSteamId) {
    return new Promise(channelPromise);

    function channelPromise(resolve) {
        var query = "SELECT * FROM channels WHERE steam_id=$1";
        db(query, [userSteamId]).then(function(result) {
            if (result.rows.length == 0) {
                resolve(null)
            } else {
                var channel = {
                    steamId: result.rows[0].steam_id,
                    key: result.rows[0].key,
                    twitchChannel: result.rows[0].twitchChannel
                };
                resolve(channel)
            }
        });
    }
};