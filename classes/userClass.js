function User(id, name, steamId, identifier, points, channel, socketId) {
    this.id = id;
    this.name = name;
    this.steamId = steamId;
    this.identifier = identifier;
    this.points = points;
    this.channel = channel;
    this.socketId = socketId;
    this.currentBets = {}; // Dictionary of things the user is currently betting on
}

module.exports = User;