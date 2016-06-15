var pg = require('pg');
var winston = require('winston');

var dbUrl = process.env.OPENSHIFT_POSTGRESQL_DB_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';

module.exports = query;
module.exports.dbUrl = dbUrl;

function query(query, values, callback) {
    pg.connect(dbUrl, function(err, client, done) {
        if (err) {
            winston.error("Error fetching client from pool", err);
            callback(err, null);
        }
        client.query(query, values, function(err, result) {
            done();
            callback(err, result);
        })
    });
}