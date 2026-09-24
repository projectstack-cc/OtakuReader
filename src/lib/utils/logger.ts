type Level = "debug" | "info" | "warn" | "error";

function log(level: Level, message: string, ...meta: unknown[]): void {
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}`;
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (meta.length) sink(line, ...meta);
  else sink(line);
}

export const appLogger = {
  debug: (message: string, ...meta: unknown[]) => log("debug", message, ...meta),
  info: (message: string, ...meta: unknown[]) => log("info", message, ...meta),
  warn: (message: string, ...meta: unknown[]) => log("warn", message, ...meta),
  error: (message: string, ...meta: unknown[]) => log("error", message, ...meta),
};
