function Channel(steamId, key, creatorName, twitchChannel) {
    // Data from the database Channel
    this.steamId = steamId; // The steamId also serves as a channel id since it is unique and necessary
    this.key = key;
    this.creatorName = creatorName;
    this.twitchChannel = twitchChannel;

    // Data specific to active channels
    this.users = [];
}

module.exports = Channel;