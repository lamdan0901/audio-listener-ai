const EventEmitter = require("events");

// Create a single, shared event emitter instance
const backendEvents = new EventEmitter();

module.exports = backendEvents;
