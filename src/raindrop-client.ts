export interface RateLimitInfo {
  limit?: number;
  remaining?: number;
  reset?: number;
}

export interface RequestOptions {
  query?: Record<string, QueryValue>;
  body?: unknown;
}

type QueryPrimitive = string | number | boolean;
type QueryValue = QueryPrimitive | null | undefined;

export interface ExportResponse {
  bodyBase64?: string;
  bodyText?: string;
  contentDisposition?: string | null;
  contentType: string;
  format: "csv" | "html" | "zip";
  result: true;
}

export class RaindropApiError extends Error {
  readonly status: number;
  readonly error?: string | number;
  readonly errorMessage?: string;
  readonly rateLimit: RateLimitInfo;
  readonly details?: unknown;

  constructor(params: {
    status: number;
    message: string;
    error?: string | number;
    errorMessage?: string;
    rateLimit: RateLimitInfo;
    details?: unknown;
  }) {
    super(params.message);
    this.name = "RaindropApiError";
    this.status = params.status;
    this.error = params.error;
    this.errorMessage = params.errorMessage;
    this.rateLimit = params.rateLimit;
    this.details = params.details;
  }
}

export interface RaindropClientOptions {
  apiBase: string;
  fetchImpl?: typeof fetch;
  token: string;
}

export class RaindropClient {
  private readonly apiBase: string;
  private readonly fetchImpl: typeof fetch;
  private readonly token: string;

  constructor(options: RaindropClientOptions) {
    this.apiBase = options.apiBase.replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.token = options.token;
  }

  async requestJson<T extends Record<string, unknown>>(
    method: string,
    path: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const response = await this.fetchImpl(this.buildUrl(path, options.query), {
      method,
      headers: this.buildJsonHeaders(),
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });

    const rateLimit = this.extractRateLimit(response.headers);
    const rawText = await response.text();
    const data = rawText ? safeJsonParse(rawText) : undefined;

    if (!response.ok) {
      throw this.createApiError(response.status, rateLimit, data, rawText);
    }

    if (data === undefined || typeof data !== "object" || Array.isArray(data)) {
      throw new RaindropApiError({
        status: response.status,
        message: "Raindrop API returned a non-object JSON payload",
        rateLimit,
        details: rawText
      });
    }

    return data as T;
  }

  async exportCollection(
    collectionId: number,
    format: "csv" | "html" | "zip",
    query?: Record<string, QueryValue>
  ): Promise<ExportResponse> {
    const response = await this.fetchImpl(
      this.buildUrl(`/raindrops/${collectionId}/export.${format}`, query),
      {
        method: "GET",
        headers: {
          Accept: "*/*",
          Authorization: `Bearer ${this.token}`
        }
      }
    );

    const rateLimit = this.extractRateLimit(response.headers);

    if (!response.ok) {
      const rawText = await response.text();
      const data = rawText ? safeJsonParse(rawText) : undefined;
      throw this.createApiError(response.status, rateLimit, data, rawText);
    }

    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    const contentDisposition = response.headers.get("content-disposition");

    if (format === "zip") {
      const bytes = new Uint8Array(await response.arrayBuffer());

      return {
        result: true,
        format,
        contentType,
        contentDisposition,
        bodyBase64: toBase64(bytes)
      };
    }

    return {
      result: true,
      format,
      contentType,
      contentDisposition,
      bodyText: await response.text()
    };
  }

  private buildJsonHeaders(): HeadersInit {
    return {
      Accept: "application/json",
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json"
    };
  }

  private buildUrl(path: string, query?: Record<string, QueryValue>): string {
    const url = new URL(`${this.apiBase}${path}`);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) {
          continue;
        }

        url.searchParams.set(key, String(value));
      }
    }

    return url.toString();
  }

  private createApiError(
    status: number,
    rateLimit: RateLimitInfo,
    data: unknown,
    rawText: string
  ): RaindropApiError {
    const normalized =
      data && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : undefined;

    const error = normalized?.error;
    const errorMessage =
      typeof normalized?.errorMessage === "string"
        ? normalized.errorMessage
        : undefined;

    return new RaindropApiError({
      status,
      error: typeof error === "string" || typeof error === "number" ? error : undefined,
      errorMessage,
      rateLimit,
      details: normalized ?? rawText,
      message:
        errorMessage ??
        `Raindrop API request failed with status ${status}`
    });
  }

  private extractRateLimit(headers: Headers): RateLimitInfo {
    return {
      limit: parseOptionalNumber(headers.get("x-ratelimit-limit")),
      remaining: parseOptionalNumber(headers.get("x-ratelimit-remaining")),
      reset: parseOptionalNumber(headers.get("x-ratelimit-reset"))
    };
  }
}

function safeJsonParse(rawText: string): unknown {
  try {
    return JSON.parse(rawText);
  } catch {
    return undefined;
  }
}

function parseOptionalNumber(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}
