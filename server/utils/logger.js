/**
 * Console timestamp logger utility
 * Overrides default console methods to include timestamps in all logs
 */

/**
 * Adds timestamps to all console logs
 */
function setupConsoleTimestamps() {
  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };

  // Format: [hh:mm:ss AM/PM]
  const getTimestamp = () => {
    const date = new Date();
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const formattedHours = (hours % 12 || 12).toString().padStart(2, "0");

    return `[${formattedHours}:${minutes}:${seconds} ${ampm}]`;
  };

  // Override console methods
  console.log = function () {
    originalConsole.log(getTimestamp(), ...arguments);
  };

  console.info = function () {
    originalConsole.info(getTimestamp(), ...arguments);
  };

  console.warn = function () {
    originalConsole.warn(getTimestamp(), ...arguments);
  };

  console.error = function () {
    originalConsole.error(getTimestamp(), ...arguments);
  };

  console.debug = function () {
    originalConsole.debug(getTimestamp(), ...arguments);
  };
}

// Export the setup function
module.exports = {
  setupConsoleTimestamps,
};
