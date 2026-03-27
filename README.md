# @gotgenes/opencode-session-context

OpenCode plugin for cross-session context access in subagent workflows.

## What it does

This package provides a plugin that exposes a `parent_session_messages` tool,
allowing subagents to read the full conversation from their parent session.

When OpenCode dispatches a subagent via the Task tool, the subagent runs in a
fresh child session with no access to the parent's conversation history.
This plugin bridges that gap by fetching the parent session's messages through
the OpenCode SDK.

## Installation

Add the plugin to your `opencode.json`:

```json
{
  "plugin": ["@gotgenes/opencode-session-context"]
}
```

## How it works

The plugin registers a `parent_session_messages` tool that:

1. Reads the current session's `parentID` via the SDK
2. Fetches all messages from the parent session
3. Returns them as structured text with agent attribution and content

The output includes full text content from each message and one-line summaries
for tool invocations (using the title computed by OpenCode).

### Output format

```text
1. user
How do I fix the login bug?

---

2. assistant (tdd) [anthropic/claude-opus-4-6]
Let me check the existing test helpers.

  [tool] Read file: web/app/auth/routes/sign-in.test.ts → completed
  [tool] bun test verify.test.ts → error: Process exited with code 1

I see the test is failing because...
```

## Use case

The primary use case is enabling a **retro-stage subagent** that can analyze
the parent session's conversation to capture retrospective observations
(friction, wins, user-side feedback) without requiring a human to invoke a
command or switch agents.
