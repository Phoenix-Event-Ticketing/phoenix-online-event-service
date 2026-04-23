export function apiError(res, status, message, errorCode, req, details) {
  const body = {
    timestamp: new Date().toISOString(),
    status,
    error: statusText(status),
    errorCode,
    message,
    requestId: req?.headers?.["x-request-id"] || null,
    traceId: req?.headers?.["x-trace-id"] || req?.headers?.traceparent || null,
  };
  if (details !== undefined) {
    body.details = details;
  }
  return res.status(status).json(body);
}

function statusText(status) {
  if (status === 400) return "Bad Request";
  if (status === 401) return "Unauthorized";
  if (status === 403) return "Forbidden";
  if (status === 404) return "Not Found";
  if (status === 409) return "Conflict";
  if (status === 500) return "Internal Server Error";
  if (status === 502) return "Bad Gateway";
  return "Error";
}
