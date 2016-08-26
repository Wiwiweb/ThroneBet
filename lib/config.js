var config;
try {
    config = require('./../secrets');
}
catch (err) {
    console.error("Unable to read secrets config file", err);
    process.exit(1);
}

module.exports = config;