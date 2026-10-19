import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-5";

let client: Anthropic | null = null;

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function getClaudeClient(): Anthropic {
  if (!isClaudeConfigured()) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set — callers should check isClaudeConfigured() and use a mock fallback instead of calling getClaudeClient()."
    );
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/**
 * Forces a single structured JSON response out of Claude via tool-use,
 * so callers (match scoring, tailoring, follow-ups) get parsed objects
 * instead of hand-rolled JSON parsing of free text.
 */
export async function callClaudeForJson<T>(params: {
  system: string;
  prompt: string;
  toolName: string;
  toolDescription: string;
  schema: Anthropic.Tool["input_schema"];
  maxTokens?: number;
}): Promise<T> {
  const anthropic = getClaudeClient();

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: params.maxTokens ?? 1500,
    system: params.system,
    messages: [{ role: "user", content: params.prompt }],
    tools: [
      {
        name: params.toolName,
        description: params.toolDescription,
        input_schema: params.schema,
      },
    ],
    tool_choice: { type: "tool", name: params.toolName },
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  if (!toolUse) {
    throw new Error("Claude did not return the expected tool call.");
  }

  return toolUse.input as T;
}
