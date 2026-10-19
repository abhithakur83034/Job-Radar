import { callClaudeForJson, isClaudeConfigured } from "./claude";

// "10.3 Follow-Up Message Drafting" — drafts a short, professional follow-up
// expressing continued interest and asking for a status update, in a tone
// appropriate for the channel (email vs. LinkedIn message).
export async function draftFollowUpMessage(params: {
  jobTitle: string;
  company: string;
  appliedAt: Date;
  channel: "email" | "linkedin";
}): Promise<string> {
  const daysElapsed = Math.round(
    (Date.now() - params.appliedAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (!isClaudeConfigured()) {
    return mockFollowUp({ ...params, daysElapsed });
  }

  const { message } = await callClaudeForJson<{ message: string }>({
    system:
      "You draft short, professional job-application follow-up messages. Keep them warm but brief, confident without being pushy, and appropriate for the stated channel.",
    prompt: `Draft a follow-up message for a ${params.channel} message.
Job title: ${params.jobTitle}
Company: ${params.company}
Days since applying: ${daysElapsed}
The candidate wants to express continued interest and ask for a status update.`,
    toolName: "draft_followup",
    toolDescription: "Return the follow-up message text.",
    schema: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"],
    },
    maxTokens: 400,
  });

  return message;
}

function mockFollowUp(params: {
  jobTitle: string;
  company: string;
  daysElapsed: number;
  channel: "email" | "linkedin";
}): string {
  if (params.channel === "linkedin") {
    return `Hi — following up on my application for the ${params.jobTitle} role at ${params.company} from ${params.daysElapsed} days ago. Still very interested and happy to share anything else that's useful. Would love any update when you have one!`;
  }
  return `Subject: Following up — ${params.jobTitle} application\n\nHi there,\n\nI applied for the ${params.jobTitle} position at ${params.company} ${params.daysElapsed} days ago and wanted to check in on the status. I remain very interested in the role and happy to provide anything else that would help.\n\nThanks for your time,\n[Your name]`;
}
