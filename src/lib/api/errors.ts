export type ProxyErrorCode =
  | 'UPSTREAM_ERROR'
  | 'RATE_LIMITED'
  | 'PARSE_ERROR'
  | 'CACHE_ERROR'
  | 'INVALID_REQUEST'
  | 'CONTENT_FILTERED'
  | 'ALL_FALLBACKS_FAILED';

export interface ProxyErrorPayload {
  code: ProxyErrorCode;
  message: string;
  statusCode: number;
  upstreamStatus?: number;
  upstreamBody?: string;
  retryAfter?: number;
  path?: string;
  cached?: boolean;
  timestamp: string;
}

export class ProxyError extends Error {
  readonly code: ProxyErrorCode;
  readonly statusCode: number;
  readonly upstreamStatus?: number;
  readonly upstreamBody?: string;
  readonly retryAfter?: number;
  readonly path?: string;
  readonly cached: boolean;
  readonly timestamp: string;

  constructor(payload: Omit<ProxyErrorPayload, 'timestamp'> & { timestamp?: string }) {
    super(payload.message);
    this.name = 'ProxyError';
    this.code = payload.code;
    this.statusCode = payload.statusCode;
    this.upstreamStatus = payload.upstreamStatus;
    this.upstreamBody = payload.upstreamBody;
    this.retryAfter = payload.retryAfter;
    this.path = payload.path;
    this.cached = payload.cached ?? false;
    this.timestamp = payload.timestamp ?? new Date().toISOString();
  }

  toJSON(): ProxyErrorPayload {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      upstreamStatus: this.upstreamStatus,
      upstreamBody: this.upstreamBody,
      retryAfter: this.retryAfter,
      path: this.path,
      cached: this.cached,
      timestamp: this.timestamp,
    };
  }
}

export function proxyErrorResponse(
  payload: Omit<ProxyErrorPayload, 'timestamp'> & { timestamp?: string },
): Response {
  const error = new ProxyError({ ...payload, timestamp: payload.timestamp });
  return new Response(
    JSON.stringify(error.toJSON()),
    {
      status: error.statusCode,
      headers: {
        'Content-Type': 'application/json',
        ...(error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {}),
      },
    },
  );
}

export function fallbackResponse(
  cached: boolean,
  fallbackMessage: string,
): Response {
  return proxyErrorResponse({
    code: 'ALL_FALLBACKS_FAILED',
    message: fallbackMessage,
    statusCode: cached ? 200 : 503,
    cached,
  });
}
