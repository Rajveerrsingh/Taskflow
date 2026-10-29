// Express 4 does not forward rejected promises to the error handler.
// Wrap async controllers so a thrown AppError still becomes a JSON response.
export function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
