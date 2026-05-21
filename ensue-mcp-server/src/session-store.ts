/**
 * Per-session state for the Streamable HTTP MCP transport.
 *
 * Each MCP client (e.g. an IronClaw worker) gets its own `mcp-session-id` header
 * after the initialize handshake. We hold a `(transport, server, lastActivity)`
 * tuple per session here so:
 *   - Subsequent JSON-RPC calls are routed to the right transport (per the MCP SDK).
 *   - Idle sessions can be swept after `idleTtlMs` so memory doesn't grow unbounded.
 *   - We can reject new sessions over `maxSessions` with 503 — defense against
 *     IronClaw reconnect storms or buggy clients.
 *
 * Defaults:
 *   maxSessions = 50    (accommodates restart bursts, rejects DoS)
 *   idleTtlMs   = 30min (matches IronClaw heartbeat scale — a session idle this long
 *                       is almost certainly a dead client)
 *
 * Tests cover this class directly without spinning up the HTTP transport.
 */

// Structural type for the bits of StreamableHTTPServerTransport / Server we touch.
// We don't import the concrete classes here to keep this file pure (no MCP SDK
// dependency in unit tests).
export interface ClosableTransport {
  /** Best-effort cleanup. May throw or be undefined; the store swallows errors. */
  close?: () => void | Promise<void>;
  /** Optional session id field used for logging. */
  sessionId?: string;
}

export interface DisposableServer {
  /** Some Server implementations expose close(); not all do. */
  close?: () => void | Promise<void>;
}

export interface SessionEntry<T extends ClosableTransport = ClosableTransport, S extends DisposableServer = DisposableServer> {
  transport: T;
  server: S;
  /** Unix ms of the last touch() / register() call. */
  lastActivity: number;
}

export interface SessionStoreOptions {
  /** Hard ceiling — register() refuses past this. Default 50. */
  maxSessions?: number;
  /** Idle TTL in ms. Sessions not touched within this window are swept. Default 30min. */
  idleTtlMs?: number;
  /** Injectable clock for deterministic testing. Defaults to Date.now. */
  now?: () => number;
}

export class SessionStore<
  T extends ClosableTransport = ClosableTransport,
  S extends DisposableServer = DisposableServer,
> {
  private readonly sessions: Map<string, SessionEntry<T, S>> = new Map();
  private readonly maxSessions: number;
  private readonly idleTtlMs: number;
  private readonly now: () => number;

  constructor(opts: SessionStoreOptions = {}) {
    this.maxSessions = opts.maxSessions ?? 50;
    this.idleTtlMs = opts.idleTtlMs ?? 30 * 60_000;
    this.now = opts.now ?? Date.now;
  }

  size(): number {
    return this.sessions.size;
  }

  isAtCapacity(): boolean {
    return this.sessions.size >= this.maxSessions;
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Mark a session as accessed and return its entry. No-op if absent.
   * Callers should treat `undefined` as "session expired or never existed".
   */
  touch(sessionId: string): SessionEntry<T, S> | undefined {
    const entry = this.sessions.get(sessionId);
    if (entry) entry.lastActivity = this.now();
    return entry;
  }

  /**
   * Register a new session. Returns `true` on success, `false` if at capacity.
   * Callers that get `false` should respond to the client with 503 and discard
   * any partially-built transport/server they may have constructed.
   */
  register(sessionId: string, transport: T, server: S): boolean {
    if (this.isAtCapacity()) return false;
    this.sessions.set(sessionId, {
      transport,
      server,
      lastActivity: this.now(),
    });
    return true;
  }

  remove(sessionId: string): SessionEntry<T, S> | undefined {
    const entry = this.sessions.get(sessionId);
    if (entry) this.sessions.delete(sessionId);
    return entry;
  }

  /**
   * Close and remove sessions whose `lastActivity` is older than `idleTtlMs`.
   * Returns the list of swept session IDs (useful for logging).
   *
   * `transport.close()` errors are swallowed — sweep must not throw because it
   * runs from a setInterval and an unhandled rejection would crash the server.
   */
  sweep(): string[] {
    const cutoff = this.now() - this.idleTtlMs;
    const swept: string[] = [];
    for (const [id, entry] of this.sessions) {
      if (entry.lastActivity < cutoff) {
        // Best-effort close. Awaiting here would block the sweep — fire and forget.
        Promise.resolve()
          .then(() => entry.transport.close?.())
          .catch(() => { /* swallow per contract */ });
        this.sessions.delete(id);
        swept.push(id);
      }
    }
    return swept;
  }

  /** Returns a snapshot of currently active session IDs. For diagnostics. */
  activeIds(): string[] {
    return [...this.sessions.keys()];
  }
}
