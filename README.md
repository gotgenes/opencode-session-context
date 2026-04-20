# @gotgenes/opencode-session-context

OpenCode plugin for cross-session context access in subagent workflows.

## What it does

This package provides a plugin that exposes `parent_session_messages` and
`session_messages` tools for reading conversation history across sessions.

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

The plugin registers two tools:

1. `parent_session_messages`
   - Reads the current session's `parentID` via the SDK
   - Fetches all messages from the parent session
2. `session_messages(sessionId)`
   - Fetches all messages from any session by ID

Both return structured text with agent attribution, full message text, and
one-line summaries for tool invocations (using the title computed by OpenCode).

### Output format

```text
1. user
How do I fix the login bug?

---

2. assistant (tdd) [anthropic/claude-opus-4 (high)]
Let me check the existing test helpers.

  [tool] Read file: web/app/auth/routes/sign-in.test.ts → completed
  [tool] bun test verify.test.ts → error: Process exited with code 1

I see the test is failing because...
```

## Use cases

### Retro-stage analysis

A retro-stage subagent can analyze the parent session's conversation to capture
retrospective observations (friction, wins, user-side feedback) without
requiring a human to invoke a command or switch agents.

### Parent-orchestrated TDD session reconstruction

In parent-orchestrator workflows, `task_id` values returned by the Task tool
are session IDs. A reviewer agent can reconstruct full TDD phase ordering by:

1. Calling `parent_session_messages` to read the orchestrator thread and
   extract `task_id` values
2. Calling `session_messages(taskId)` for each `tdd-red`, `tdd-green`, and
   `tdd-refactor` subagent session
3. Reviewing full per-phase detail, including file writes, test runs, and
   checkpoint calls
