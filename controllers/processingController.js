const baseController = require("./baseController");
const { tryCatch } = require("../lib/tryCatch");

/**
 * Controller for handling processing state operations
 */

/**
 * Cancels any ongoing processing
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} io - Socket.io instance
 * @returns {Promise<void>}
 */
async function cancelProcessing(req, res, io) {
  console.log("Canceling processing...");

  const result = await tryCatch(async () => {
    // Set the processing cancelled flag
    baseController.setCancelled(true);

    // Emit cancellation event to clients
    io.emit("processingCancelled", { message: "Processing cancelled" });

    // Reset the cancelled state for the next request
    setTimeout(() => {
      baseController.setCancelled(false);
      console.log("Cancelled state reset for next operation");
    }, 1000);

    return { success: true, message: "Processing cancelled successfully" };
  });

  if (result.error) {
    console.error("Error cancelling processing:", result.error);
    return res.status(500).json({
      success: false,
      error: result.error.message || "Failed to cancel processing",
    });
  }

  return res.status(200).json(result.data);
}

module.exports = {
  cancelProcessing,
};
