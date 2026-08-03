type LogLevel = "debug" | "info" | "warn" | "error";

function isDev(): boolean {
  return process.env.NODE_ENV !== "production";
}

function isDebugEnabled(): boolean {
  if (typeof window === "undefined") {
    return isDev();
  }
  try {
    return (
      isDev() ||
      window.localStorage.getItem("bq.wallet.debug") === "1" ||
      new URLSearchParams(window.location.search).has("walletDebug")
    );
  } catch {
    return isDev();
  }
}

function write(level: LogLevel, event: string, payload?: unknown) {
  if (level === "debug" && !isDebugEnabled()) {
    return;
  }
  if (level === "info" && !isDebugEnabled() && !isDev()) {
    return;
  }

  const prefix = `[wallet:${level}] ${event}`;
  if (level === "error") {
    console.error(prefix, payload ?? "");
    return;
  }
  if (level === "warn") {
    console.warn(prefix, payload ?? "");
    return;
  }
  console.info(prefix, payload ?? "");
}

export const walletLogger = {
  debug: (event: string, payload?: unknown) => write("debug", event, payload),
  info: (event: string, payload?: unknown) => write("info", event, payload),
  warn: (event: string, payload?: unknown) => write("warn", event, payload),
  error: (event: string, payload?: unknown) => write("error", event, payload),
};
