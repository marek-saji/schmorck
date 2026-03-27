export interface ApiShield {
  pause(): void;
  resume(): void;
  fetch(url: string | URL | Request, options?: RequestInit): Promise<Response>;
  backOff(backOffTimeMs: number): void;
  readonly queueLength: number;
}

export interface ApiShieldOptions {
  /** Maximum requests per minute. Pass Infinity to only serialize without rate limiting. */
  rateLimitReqPerMin: number;
  /** Maximum mutating requests (POST/PUT/DELETE/PATCH) per minute. Must be <= rateLimitReqPerMin. When omitted, all methods share rateLimitReqPerMin. */
  rateLimitMutatePerMin?: number;
  /** How long to wait on 429 when neither Retry-After nor X-Ratelimit.until provide a value. @default 60_000 */
  fallbackRetryMs?: number;
  /** How long to back off when X-Ratelimit header is present but contains unparseable JSON. @default 1_000 */
  malformedHeaderBackoffMs?: number;
}

export function createApiShield(options: ApiShieldOptions): ApiShield;
