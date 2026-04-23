type LogLevel = "INFO" | "WARN" | "ERROR";

export function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...meta
  };
  // Structured logs for production collectors.
  console.log(JSON.stringify(payload));
}

export function logInfo(message: string, meta?: Record<string, unknown>) {
  log("INFO", message, meta);
}

export function logWarn(message: string, meta?: Record<string, unknown>) {
  log("WARN", message, meta);
}

export function logError(message: string, meta?: Record<string, unknown>) {
  log("ERROR", message, meta);
}
