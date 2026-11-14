/**
 * Typed server errors. Route handlers map these to HTTP status codes
 * (see $lib/server/http.ts in Phase 4).
 */

/** The caller is authenticated but does not own the target resource. */
export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** No authenticated user for a request that requires one. */
export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}
