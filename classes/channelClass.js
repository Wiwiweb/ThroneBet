function Channel(steamId, key, creator) {
    this.steamId = steamId;
    this.key = key;
    this.creator = creator;
    this.users = [];
}

module.exports = Channel;