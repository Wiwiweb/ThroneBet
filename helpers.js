module.exports.getChannel = function(userId) {
    return new Promise(channelPromise);

    function channelPromise(resolve) {
        var query = "SELECT * FROM channels WHERE creator_id=$1";
        db(query, [userId]).then(function(result) {
            if (result.rows.length == 0) {
                resolve(null)
            } else {
                resolve(result.rows[0])
            }
        });
    }
};