import { describe, expect, test } from "bun:test";
import { ParentSessionPlugin } from "./parent-session";
import { makeClient, makeContext } from "./test-helpers";

describe("session_messages", () => {
  test("returns message when requested session has no messages", async () => {
    const client = makeClient({
      session: {
        messages: () => Promise.resolve({ data: [] }),
      },
    });

    const hooks = await ParentSessionPlugin({ client } as any);
    const result = await hooks.tool!.session_messages.execute(
      { sessionId: "phase-session-1" },
      makeContext() as any,
    );

    expect(result).toEqual("Session phase-session-1 has no messages.");
  });

  test("formats a full session with user messages, assistant messages, and tool parts", async () => {
    const client = makeClient({
      session: {
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
                    text: "Run the red phase tests.",
                  },
                ],
              },
              {
                info: {
                  role: "assistant",
                  agent: "tdd-red",
                  providerID: "anthropic",
                  modelID: "claude-opus-4-6",
                },
                parts: [
                  {
                    type: "text",
                    text: "I will run the targeted suite first.",
                  },
                  {
                    type: "tool",
                    tool: "bash",
                    state: {
                      status: "completed",
                      title: "bun test auth.red.test.ts",
                      input: { command: "bun test auth.red.test.ts" },
                      metadata: {},
                      time: { start: 1, end: 2 },
                    },
                  },
                  {
                    type: "tool",
                    tool: "write",
                    state: {
                      status: "error",
                      title: "Write failing test",
                      input: { filePath: "src/auth/auth.red.test.ts" },
                      error: "Permission denied",
                      metadata: {},
                      time: { start: 3, end: 4 },
                    },
                  },
                  {
                    type: "text",
                    text: "The test fails as expected.",
                  },
                ],
              },
            ],
          }),
      },
    });

    const hooks = await ParentSessionPlugin({ client } as any);
    const result = await hooks.tool!.session_messages.execute(
      { sessionId: "phase-session-2" },
      makeContext() as any,
    );

    const expected = [
      "1. user",
      "Run the red phase tests.",
      "",
      "---",
      "",
      "2. assistant (tdd-red) [anthropic/claude-opus-4-6]",
      "I will run the targeted suite first.",
      "  [tool] bun test auth.red.test.ts → completed",
      '    input: {"command":"bun test auth.red.test.ts"}',
      "  [tool] Write failing test → error: Permission denied",
      '    input: {"filePath":"src/auth/auth.red.test.ts"}',
      "The test fails as expected.",
    ].join("\n");

    expect(result).toEqual(expected);
  });

  test("includes model variant in assistant message header when present", async () => {
    const client = makeClient({
      session: {
        messages: () =>
          Promise.resolve({
            data: [
              {
                info: {
                  role: "assistant",
                  agent: "tdd-refactor",
                  providerID: "anthropic",
                  modelID: "claude-opus-4",
                  variant: "high",
                },
                parts: [
                  {
                    type: "text",
                    text: "Refactor complete.",
                  },
                ],
              },
            ],
          }),
      },
    });

    const hooks = await ParentSessionPlugin({ client } as any);
    const result = await hooks.tool!.session_messages.execute(
      { sessionId: "phase-session-3" },
      makeContext() as any,
    );

    const expected = [
      "1. assistant (tdd-refactor) [anthropic/claude-opus-4 (high)]",
      "Refactor complete.",
    ].join("\n");

    expect(result).toEqual(expected);
  });

  test("omits input line when input is empty, null, or undefined", async () => {
    const client = makeClient({
      session: {
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
    const result = await hooks.tool!.session_messages.execute(
      { sessionId: "phase-session-4" },
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
