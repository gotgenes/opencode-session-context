import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import type { Part } from "@opencode-ai/sdk";
import type { AssistantMessageInfo, MessageWithParts } from "./types";

function formatTool(part: Part & { type: "tool" }): string {
  const state = part.state as Record<string, unknown>;
  const status = state.status as string;
  const title = (state.title as string | undefined) ?? part.tool;
  if (status === "error") {
    return `  [tool] ${title} → error: ${state.error}`;
  }
  return `  [tool] ${title} → ${status}`;
}

function formatParts(parts: Part[]): string {
  const lines: string[] = [];
  for (const part of parts) {
    if (part.type === "text") {
      lines.push(part.text);
    } else if (part.type === "tool") {
      lines.push(formatTool(part as Part & { type: "tool" }));
    }
  }
  return lines.join("\n");
}

function formatModel(info: AssistantMessageInfo): string {
  const base = `${info.providerID}/${info.modelID}`;
  return info.variant ? `${base} (${info.variant})` : base;
}

function formatMessage(msg: MessageWithParts, index: number): string {
  const num = index + 1;
  if (msg.info.role === "assistant") {
    const info = msg.info as AssistantMessageInfo;
    const agent = info.agent ?? "unknown";
    const header = `${num}. assistant (${agent}) [${formatModel(info)}]`;
    return `${header}\n${formatParts(msg.parts)}`;
  }
  return `${num}. ${msg.info.role}\n${formatParts(msg.parts)}`;
}

export const ParentSessionPlugin: Plugin = async ({ client }) => {
  return {
    tool: {
      parent_session_messages: tool({
        description:
          "Fetch all messages from the parent session. " +
          "Returns the full conversation with agent attribution " +
          "and message content. Only works from subagent sessions " +
          "(sessions with a parentID).",
        args: {},
        async execute(_args, context) {
          const session = await client.session.get({
            path: { id: context.sessionID },
          });
          const parent = (session.data as Record<string, unknown>)?.parentID as
            | string
            | undefined;
          if (!parent) {
            return "Error: This session has no parent. This tool only works from subagent sessions.";
          }

          const response = await client.session.messages({
            path: { id: parent },
          });
          const messages = (response.data ?? []) as MessageWithParts[];
          if (messages.length === 0) {
            return "The parent session has no messages.";
          }

          return messages.map(formatMessage).join("\n\n---\n\n");
        },
      }),
    },
  };
};
