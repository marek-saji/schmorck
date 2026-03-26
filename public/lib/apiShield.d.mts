export interface ApiShield {
  queue(task: () => Promise<Response>, options?: { signal?: AbortSignal }): Promise<Response>;
  pause(): void;
  resume(): void;
  fetch(url: string | URL | Request, options?: RequestInit): Promise<Response>;
  backOff(backOffTimeMs: number): void;
  readonly queueLength: number;
}

export interface ApiShieldOptions {
  rateLimitReqPerMin: number;
}

export function createApiShield(options: ApiShieldOptions): ApiShield;
