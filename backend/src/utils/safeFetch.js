import { env } from '../config/env.js';

export const USER_AGENT = 'JobRadar/1.0 (personal job-matching feed; +https://job-radar-lime.vercel.app)';

/** Typed failure from an outbound request; `code` is safe to show to admins. */
export class FetchError extends Error {
  constructor(code, message, { status, retryAfterMs } = {}) {
    super(message);
    this.name = 'FetchError';
    this.code = code; // HTTP_<status> | NOT_FOUND | RATE_LIMITED | TIMEOUT | NETWORK | TOO_LARGE | BAD_RESPONSE
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isTransient(err) {
  return ['TIMEOUT', 'NETWORK', 'RATE_LIMITED'].includes(err.code) || (err.status >= 500 && err.status < 600);
}

function parseRetryAfter(header) {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

async function readBodyWithLimit(res, maxBytes) {
  const declared = Number(res.headers.get('content-length'));
  if (declared && declared > maxBytes) {
    throw new FetchError('TOO_LARGE', `Response is ${declared} bytes (limit ${maxBytes})`);
  }
  if (!res.body) return '';

  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    if (received > maxBytes) {
      await reader.cancel();
      throw new FetchError('TOO_LARGE', `Response exceeded ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function attempt(url, { method, headers, body, timeoutMs, maxBytes }) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers },
      body,
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new FetchError('TIMEOUT', `Timed out after ${timeoutMs}ms`);
    }
    throw new FetchError('NETWORK', err.cause?.code || err.message || 'Network error');
  }

  if (res.status === 404) throw new FetchError('NOT_FOUND', 'Not found', { status: 404 });
  if (res.status === 429) {
    throw new FetchError('RATE_LIMITED', 'Rate limited by source', {
      status: 429,
      retryAfterMs: parseRetryAfter(res.headers.get('retry-after')),
    });
  }
  if (!res.ok) throw new FetchError(`HTTP_${res.status}`, `Source returned HTTP ${res.status}`, { status: res.status });

  const text = await readBodyWithLimit(res, maxBytes);
  try {
    return JSON.parse(text);
  } catch {
    throw new FetchError('BAD_RESPONSE', 'Source returned invalid JSON');
  }
}

/**
 * Fetch JSON with a timeout, response-size limit and bounded retries
 * (exponential backoff + jitter, transient failures only).
 */
export async function fetchJson(
  url,
  {
    method = 'GET',
    headers = {},
    body,
    timeoutMs = env.JOB_FETCH_TIMEOUT_MS,
    retries = env.JOB_FETCH_MAX_RETRIES,
    maxBytes = 10 * 1024 * 1024,
    baseDelayMs = 500,
  } = {}
) {
  for (let tryNumber = 0; ; tryNumber++) {
    try {
      return await attempt(url, { method, headers, body, timeoutMs, maxBytes });
    } catch (err) {
      if (!(err instanceof FetchError) || !isTransient(err) || tryNumber >= retries) throw err;
      const backoff = baseDelayMs * 2 ** tryNumber + Math.random() * baseDelayMs;
      // Honour Retry-After, but never wait longer than 30s inside a refresh run
      await sleep(Math.min(err.retryAfterMs ?? backoff, 30000));
    }
  }
}
