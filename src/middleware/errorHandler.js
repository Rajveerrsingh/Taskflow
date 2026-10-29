import { AppError } from "../errors/AppError.js";

export function errorHandler(err, _req, res, _next) {
  const parseStatus = err?.status || err?.statusCode;
  if (err instanceof SyntaxError && parseStatus === 400 && "body" in err) {
    return res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "Request body must be valid JSON.",
      },
    });
  }

  if (err?.name === "ValidationError" && err.errors) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Some fields need attention.",
        details: Object.values(err.errors).map((issue) => ({
          field: issue.path,
          message: issue.message,
        })),
      },
    });
  }

  if (err?.name === "CastError") {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Task not found.",
      },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  if (process.env.NODE_ENV !== "test") console.error(err);
  return res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong.",
    },
  });
}
