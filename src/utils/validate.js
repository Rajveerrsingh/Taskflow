import { AppError } from "../errors/AppError.js";

export function parse(schema, payload) {
  const result = schema.safeParse(payload ?? {});
  if (result.success) return result.data;

  throw new AppError("Some fields need attention.", {
    status: 400,
    code: "VALIDATION_ERROR",
    details: result.error.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.join(".") : "body",
      message: issue.message,
    })),
  });
}
