var pg = require('pg');
var winston = require('winston');

var dbUrl = process.env.OPENSHIFT_POSTGRESQL_DB_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';

module.exports = query;
module.exports.dbUrl = dbUrl;

function query(query, values) {
    return new Promise(queryPromise);

    function queryPromise(resolve, reject) {
        pg.connect(dbUrl, function(err, client, done) {
            if (err) {
                reject(winston.error("Error fetching client from pool:", err));
            }
            client.query(query, values, function(err, result) {
                done();
                if (err) {
                    reject(winston.error("Error executing query:", err, query, values));
                }
                resolve(result);
            })
        });
    }
}
