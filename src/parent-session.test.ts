import { describe, expect, test } from "bun:test";
import { ParentSessionPlugin } from "./parent-session";

function makeClient(
  overrides: { session?: { get?: any; messages?: any } } = {},
) {
  return {
    session: {
      get: overrides.session?.get ?? (() => Promise.resolve({ data: {} })),
      messages:
        overrides.session?.messages ?? (() => Promise.resolve({ data: [] })),
    },
  };
}

function makeContext(overrides: Partial<{ sessionID: string }> = {}) {
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

describe("parent_session_messages", () => {
  test("returns error when session has no parent", async () => {
    const client = makeClient({
      session: {
        get: () => Promise.resolve({ data: { id: "child-session-1" } }),
      },
    });

    const hooks = await ParentSessionPlugin({ client } as any);
    const result = await hooks.tool!.parent_session_messages.execute(
      {},
      makeContext() as any,
    );

    expect(result).toContain("no parent");
  });

  test("returns message when parent session has no messages", async () => {
    const client = makeClient({
      session: {
        get: () =>
          Promise.resolve({
            data: { id: "child-session-1", parentID: "parent-session-1" },
          }),
        messages: () => Promise.resolve({ data: [] }),
      },
    });

    const hooks = await ParentSessionPlugin({ client } as any);
    const result = await hooks.tool!.parent_session_messages.execute(
      {},
      makeContext() as any,
    );

    expect(result).toContain("no messages");
  });

  test("formats a full session with user messages, assistant messages, and tool parts", async () => {
    const client = makeClient({
      session: {
        get: () =>
          Promise.resolve({
            data: { id: "child-session-1", parentID: "parent-session-1" },
          }),
        messages: () =>
          Promise.resolve({
            data: [
              {
                info: {
                  role: "user",
                  agent: "tdd",
                  providerID: "anthropic",
                  modelID: "claude-opus-4-6",
                },
                parts: [
                  {
                    type: "text",
                    text: "Fix the login bug",
                  },
                ],
              },
              {
                info: {
                  role: "assistant",
                  agent: "tdd",
                  providerID: "anthropic",
                  modelID: "claude-opus-4-6",
                },
                parts: [
                  {
                    type: "text",
                    text: "Let me check the auth flow.",
                  },
                  {
                    type: "tool",
                    tool: "read",
                    state: {
                      status: "completed",
                      title: "Read file: src/auth/login.ts",
                      input: { filePath: "src/auth/login.ts" },
                      output: "file contents...",
                      metadata: {},
                      time: { start: 1, end: 2 },
                    },
                  },
                  {
                    type: "tool",
                    tool: "bash",
                    state: {
                      status: "error",
                      title: "bun test login.test.ts",
                      input: { command: "bun test login.test.ts" },
                      error: "Process exited with code 1",
                      metadata: {},
                      time: { start: 3, end: 4 },
                    },
                  },
                  {
                    type: "tool",
                    tool: "parent_session_messages",
                    state: {
                      status: "completed",
                      title: "Fetch parent session messages",
                      input: {},
                      metadata: {},
                      time: { start: 5, end: 6 },
                    },
                  },
                  {
                    type: "tool",
                    tool: "question",
                    state: {
                      status: "completed",
                      title: "Ask user a question",
                      input: {
                        question: "Which approach do you prefer?",
                        options: ["Option A", "Option B"],
                      },
                      metadata: {},
                      time: { start: 7, end: 8 },
                    },
                  },
                  {
                    type: "text",
                    text: "The test is failing because of a missing import.",
                  },
                ],
              },
            ],
          }),
      },
    });

    const hooks = await ParentSessionPlugin({ client } as any);
    const result = await hooks.tool!.parent_session_messages.execute(
      {},
      makeContext() as any,
    );

    // User message: shows role and content, no agent attribution
    expect(result).toContain("1. user");
    expect(result).toContain("Fix the login bug");

    // Assistant message: shows role, agent, model
    expect(result).toContain("2. assistant (tdd) [anthropic/claude-opus-4-6]");
    expect(result).toContain("Let me check the auth flow.");

    // Tool parts: one-line summaries using state.title
    expect(result).toContain("[tool] Read file: src/auth/login.ts → completed");
    expect(result).toContain(
      "[tool] bun test login.test.ts → error: Process exited with code 1",
    );

    // Tool input is included beneath the summary
    expect(result).toContain('input: {"filePath":"src/auth/login.ts"}');
    expect(result).toContain('input: {"command":"bun test login.test.ts"}');

    // Internal tools: arguments are visible when present
    expect(result).toContain("[tool] Ask user a question → completed");
    expect(result).toContain(
      'input: {"question":"Which approach do you prefer?","options":["Option A","Option B"]}',
    );

    // Internal tools with no arguments omit the input line
    expect(result).toContain(
      "[tool] Fetch parent session messages → completed",
    );
    const fetchLine = result.indexOf(
      "[tool] Fetch parent session messages → completed",
    );
    const afterFetch = result.slice(
      fetchLine + "[tool] Fetch parent session messages → completed".length,
    );
    expect(afterFetch.startsWith("\n    input:")).toBe(false);

    // Messages are separated
    expect(result).toContain("---");

    // Full tool output is NOT included
    expect(result).not.toContain("file contents...");
  });

  test("includes model variant in assistant message header when present", async () => {
    const client = makeClient({
      session: {
        get: () =>
          Promise.resolve({
            data: { id: "child-session-1", parentID: "parent-session-1" },
          }),
        messages: () =>
          Promise.resolve({
            data: [
              {
                info: {
                  role: "assistant",
                  agent: "build",
                  providerID: "anthropic",
                  modelID: "claude-opus-4",
                  variant: "high",
                },
                parts: [
                  {
                    type: "text",
                    text: "On it.",
                  },
                ],
              },
            ],
          }),
      },
    });

    const hooks = await ParentSessionPlugin({ client } as any);
    const result = await hooks.tool!.parent_session_messages.execute(
      {},
      makeContext() as any,
    );

    expect(result).toContain(
      "1. assistant (build) [anthropic/claude-opus-4 (high)]",
    );
  });

  test("omits input line when input is empty, null, or undefined", async () => {
    const client = makeClient({
      session: {
        get: () =>
          Promise.resolve({
            data: { id: "child-session-1", parentID: "parent-session-1" },
          }),
        messages: () =>
          Promise.resolve({
            data: [
              {
                info: {
                  role: "assistant",
                  agent: "build",
                  providerID: "anthropic",
                  modelID: "claude-opus-4-6",
                },
                parts: [
                  {
                    type: "tool",
                    tool: "empty-input",
                    state: {
                      status: "completed",
                      title: "Tool with empty input",
                      input: {},
                    },
                  },
                  {
                    type: "tool",
                    tool: "null-input",
                    state: {
                      status: "completed",
                      title: "Tool with null input",
                      input: null,
                    },
                  },
                  {
                    type: "tool",
                    tool: "missing-input",
                    state: {
                      status: "completed",
                      title: "Tool with no input",
                    },
                  },
                ],
              },
            ],
          }),
      },
    });

    const hooks = await ParentSessionPlugin({ client } as any);
    const result = await hooks.tool!.parent_session_messages.execute(
      {},
      makeContext() as any,
    );

    // All three should render as simple one-liners without an input line
    expect(result).toContain("[tool] Tool with empty input → completed");
    expect(result).toContain("[tool] Tool with null input → completed");
    expect(result).toContain("[tool] Tool with no input → completed");
    expect(result).not.toContain("input:");
  });
});
