export type WalletErrorCode =
  | "WALLET_NOT_CONNECTED"
  | "WRONG_CHAIN"
  | "PROVIDER_UNAVAILABLE"
  | "METHOD_UNSUPPORTED"
  | "USER_REJECTED"
  | "TRANSACTION_FAILED"
  | "RECEIPT_TIMEOUT"
  | "CAPABILITY_UNAVAILABLE"
  | "UNKNOWN_PROVIDER"
  | "SWITCH_REJECTED";

export class WalletError extends Error {
  readonly code: WalletErrorCode;
  readonly cause?: unknown;

  constructor(code: WalletErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "WalletError";
    this.code = code;
    this.cause = cause;
  }
}

export function isWalletError(error: unknown): error is WalletError {
  return error instanceof WalletError;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

export function isUserRejectedError(error: unknown): boolean {
  if (isWalletError(error) && error.code === "USER_REJECTED") {
    return true;
  }
  return /user rejected|denied|request denied|user cancelled|canceled/i.test(
    getErrorMessage(error),
  );
}

export function isMethodUnsupportedError(error: unknown): boolean {
  if (isWalletError(error) && error.code === "METHOD_UNSUPPORTED") {
    return true;
  }
  const message = getErrorMessage(error).toLowerCase();
  const name =
    error instanceof Error ? error.name.toLowerCase() : "";
  return (
    name.includes("unsupportedmethod") ||
    message.includes("does not support") ||
    message.includes("not supported") ||
    message.includes("unsupported") ||
    message.includes("method not found") ||
    message.includes("unknown method") ||
    message.includes("invalid method") ||
    message.includes("does not exist / is not available") ||
    message.includes("missing or invalid. request()")
  );
}

export function toWalletError(error: unknown): WalletError {
  if (isWalletError(error)) {
    return error;
  }
  if (isUserRejectedError(error)) {
    return new WalletError(
      "USER_REJECTED",
      "Transaction was rejected in your wallet.",
      error,
    );
  }
  if (isMethodUnsupportedError(error)) {
    return new WalletError(
      "METHOD_UNSUPPORTED",
      "This wallet does not support the requested method.",
      error,
    );
  }
  return new WalletError(
    "TRANSACTION_FAILED",
    getErrorMessage(error) || "Transaction failed.",
    error,
  );
}

/** Stable UI copy for known wallet failures. */
export function walletErrorToUserMessage(error: unknown): string {
  const walletError = toWalletError(error);
  switch (walletError.code) {
    case "WALLET_NOT_CONNECTED":
      return "Connect your wallet to continue.";
    case "WRONG_CHAIN":
    case "SWITCH_REJECTED":
      return "Please switch your wallet to Base Mainnet.";
    case "USER_REJECTED":
      return "Transaction was rejected in your wallet.";
    case "PROVIDER_UNAVAILABLE":
    case "UNKNOWN_PROVIDER":
      return "Wallet provider is unavailable. Reconnect and try again.";
    case "METHOD_UNSUPPORTED":
    case "CAPABILITY_UNAVAILABLE":
      return "This wallet does not support the required method.";
    case "RECEIPT_TIMEOUT":
      return "Timed out waiting for transaction confirmation.";
    default:
      return walletError.message;
  }
}
