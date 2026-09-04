/**
 * Domain error hierarchy. Route handlers map these to HTTP status codes;
 * nothing else should throw bare strings.
 */

export class AppError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(code: string, message: string, httpStatus = 400, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super("validation_error", message, 422, details);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string) {
    super("not_found", `${entity} not found`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super("unauthorized", message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this resource") {
    super("forbidden", message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("conflict", message, 409);
  }
}

/** Payment / gateway problems that are not the caller's fault. */
export class PaymentError extends AppError {
  constructor(message: string, details?: unknown) {
    super("payment_error", message, 502, details);
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
