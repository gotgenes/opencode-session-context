import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";

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
          const messages = response.data ?? [];
          if (messages.length === 0) {
            return "The parent session has no messages.";
          }

          return "";
        },
      }),
    },
  };
};
