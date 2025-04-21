/**
 * @template T
 * @typedef {Object} Success
 * @property {T} data - The resolved data.
 * @property {null} error - Always null on success.
 */

/**
 * @template E
 * @typedef {Object} Failure
 * @property {null} data - Always null on failure.
 * @property {E} error - The error that occurred.
 */

/**
 * @template T, E
 * @typedef {Success<T> | Failure<E>} Result
 *
 * @description
 * A union type representing either a successful result ({ data, error: null })
 * or a failure ({ data: null, error }).
 * @note E defaults to Error if not otherwise specified.
 */

/**
 * Wraps a promise and returns a Result object instead of throwing.
 *
 * @template T, E
 * @param {Promise<T>} promise - The promise to await.
 * @returns {Promise<Result<T, E>>} A promise that resolves to a Result.
 */

async function tryCatch(promise) {
  try {
    const data = await promise;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

module.exports = { tryCatch };
