// src/utils/fetchWithTimeout.ts
//
// The backend (pedal-delivery-back.onrender.com) runs on Render's free
// tier, which spins the instance down after ~15 minutes idle and can take
// 30-90+ seconds to wake back up on the next request. Every fetch() call
// in this app has no timeout, so when that cold start happens the promise
// just never settles — the screen's "Loading..." spinner sits there
// forever with zero feedback, indistinguishable from the app being
// broken (this is what showed up as Available Orders / Earnings /
// Profile all stuck on "Loading..." simultaneously and never resolving).
//
// This wraps fetch() with an AbortController so a slow/cold/dead request
// fails visibly after `timeoutMs` instead of hanging indefinitely, so
// screens can show a real error + retry button rather than an infinite
// spinner. It does not fix the underlying cold-start latency itself —
// that's a Render hosting-tier problem (see the note where this is used)
// — it fixes the app pretending to be frozen while waiting on it.
export class FetchTimeoutError extends Error {
  constructor() {
    super("Request timed out");
    this.name = "FetchTimeoutError";
  }
}

export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs: number = 20000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new FetchTimeoutError();
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
