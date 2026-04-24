type SessionGet = (
  _args?: unknown,
) => Promise<{ data: Record<string, unknown> }>;
type SessionMessages = (_args?: unknown) => Promise<{ data: unknown[] }>;

export function makeClient(
  overrides: {
    session?: { get?: SessionGet; messages?: SessionMessages };
  } = {},
) {
  return {
    session: {
      get: overrides.session?.get ?? (() => Promise.resolve({ data: {} })),
      messages:
        overrides.session?.messages ?? (() => Promise.resolve({ data: [] })),
    },
  };
}

export function makeContext(overrides: Partial<{ sessionID: string }> = {}) {
  return {
    sessionID: overrides.sessionID ?? "child-session-1",
    messageID: "msg-1",
    agent: "test",
    directory: "/tmp",
    worktree: "/tmp",
    abort: new AbortController().signal,
    metadata: () => {},
    ask: () => Promise.resolve(),
  };
}
