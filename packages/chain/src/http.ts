export class ChainSourceError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "ChainSourceError";
    this.status = status;
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;

export async function fetchJson(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        accept: "application/json",
        ...init.headers,
      },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "TimeoutError"
        ? "The request timed out."
        : "The endpoint could not be reached.";
    throw new ChainSourceError(reason);
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new ChainSourceError(
      `The endpoint returned HTTP ${response.status}.`,
      response.status,
    );
  }

  try {
    return await response.json();
  } catch {
    throw new ChainSourceError("The endpoint returned an invalid JSON response.");
  }
}
