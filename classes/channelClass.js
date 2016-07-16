function Channel(steamId, key, creatorName, twitchChannel) {
    this.steamId = steamId;
    this.key = key;
    this.creatorName = creatorName;
    this.twitchChannel = twitchChannel;
    this.users = [];
}

module.exports = Channel;