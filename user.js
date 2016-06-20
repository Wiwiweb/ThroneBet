function User(name, steamId, identifier, points, channel) {
    this.name = name;
    this.steamId = steamId;
    this.identifier = identifier;
    this.points = points;
    this.channel = channel;
    this.currentBets = {}; // Dictionary of things the user is currently betting on
}

module.exports = User;