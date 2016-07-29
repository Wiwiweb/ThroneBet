function User(id, name, steamId, identifier, points, channelJoined, socketId) {
    // Data from the database User
    this.id = id;
    this.name = name;
    this.steamId = steamId;
    this.identifier = identifier;
    this.points = points;

    // Data specific to active users in a channel
    this.channelJoined = channelJoined;
    this.socketId = socketId;
    this.currentBets = {}; // Dictionary of things the user is currently betting on
}

module.exports = User;