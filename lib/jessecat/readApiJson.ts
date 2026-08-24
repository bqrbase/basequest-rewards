export type ApiJsonResult<T> = {
  ok: boolean;
  status: number;
  contentType: string;
  json: T | null;
  message: string;
};

function looksLikeHtml(contentType: string, text: string): boolean {
  return contentType.includes("text/html") || /^\s*</.test(text);
}

/**
 * Read a fetch Response as JSON without throwing on HTML/404 pages.
 */
export async function readApiJson<T extends Record<string, unknown>>(
  response: Response,
  fallbackMessage: string,
): Promise<ApiJsonResult<T>> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();

  if (!text.trim()) {
    return {
      ok: false,
      status: response.status,
      contentType,
      json: null,
      message: `${fallbackMessage} Empty response (${response.status}).`,
    };
  }

  try {
    const json = JSON.parse(text) as T;
    const message =
      (typeof json.message === "string" && json.message.trim()) ||
      (typeof json.error === "string" && json.error.trim()) ||
      (response.ok ? fallbackMessage : `${fallbackMessage} (${response.status})`);

    return {
      ok: response.ok,
      status: response.status,
      contentType,
      json,
      message,
    };
  } catch {
    const html = looksLikeHtml(contentType, text);
    return {
      ok: false,
      status: response.status,
      contentType,
      json: null,
      message: html
        ? `${fallbackMessage} The server returned a web page instead of JSON (${response.status}). Restart the Next.js server if this persists.`
        : `${fallbackMessage} Invalid server response (${response.status}).`,
    };
  }
}
