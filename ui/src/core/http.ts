// Thin fetch wrapper (replaces Angular's HttpClient). Non-2xx responses throw
// an HttpError carrying the parsed JSON body, like HttpErrorResponse.error.
export class HttpError extends Error {
  constructor(
    public status: number,
    public body: unknown
  ) {
    super(`HTTP ${status}`);
  }
}

export async function request<T>(
  method: string,
  url: string,
  options: { body?: unknown; headers?: Record<string, string> } = {}
): Promise<T> {
  const headers: Record<string, string> = { ...options.headers };
  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body; // browser sets the multipart boundary
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) throw new HttpError(res.status, data);
  return data as T;
}
