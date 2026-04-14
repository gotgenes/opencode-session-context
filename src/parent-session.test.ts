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

    expect(result).toEqual(
      "Error: This session has no parent. This tool only works from subagent sessions.",
    );
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

    expect(result).toEqual("The parent session has no messages.");
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

    const expected = [
      "1. user",
      "Fix the login bug",
      "",
      "---",
      "",
      "2. assistant (tdd) [anthropic/claude-opus-4-6]",
      "Let me check the auth flow.",
      "  [tool] Read file: src/auth/login.ts → completed",
      '    input: {"filePath":"src/auth/login.ts"}',
      "  [tool] bun test login.test.ts → error: Process exited with code 1",
      '    input: {"command":"bun test login.test.ts"}',
      "  [tool] Fetch parent session messages → completed",
      "  [tool] Ask user a question → completed",
      '    input: {"question":"Which approach do you prefer?","options":["Option A","Option B"]}',
      "The test is failing because of a missing import.",
    ].join("\n");

    expect(result).toEqual(expected);
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

    const expected = [
      "1. assistant (build) [anthropic/claude-opus-4 (high)]",
      "On it.",
    ].join("\n");

    expect(result).toEqual(expected);
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

    const expected = [
      "1. assistant (build) [anthropic/claude-opus-4-6]",
      "  [tool] Tool with empty input → completed",
      "  [tool] Tool with null input → completed",
      "  [tool] Tool with no input → completed",
    ].join("\n");

    expect(result).toEqual(expected);
  });
});
