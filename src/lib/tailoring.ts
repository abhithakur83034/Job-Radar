import { callClaudeForJson, isClaudeConfigured } from "./claude";
import type { ParsedResume, TailoredMaterials } from "./types";
import type { NormalizedListing } from "./connectors/types";

// "10.2 Resume & Cover Letter Tailoring Prompt" — reorders and reframes
// existing resume content to emphasize what's most relevant to this job, and
// drafts a cover letter referencing specific details from the job
// description. Explicitly instructed not to invent skills, experience, or
// qualifications the user doesn't actually have (see "4.3 Scope Boundaries").
export async function generateTailoredMaterials(
  resume: ParsedResume,
  listing: NormalizedListing
): Promise<TailoredMaterials> {
  if (!isClaudeConfigured()) {
    return mockTailor(resume, listing);
  }

  return callClaudeForJson<TailoredMaterials>({
    system:
      "You are JobRadar's tailoring engine. You reorder and reframe a candidate's REAL resume content to emphasize what's most relevant to a specific job — you never invent skills, employers, titles, or accomplishments that aren't already present in the source resume. Mark every change to the resume by wrapping added/reworded text in <ins> tags and removed text in <del> tags, inline, so the user can see exactly what changed before they submit anything.",
    prompt: `CANDIDATE'S ORIGINAL RESUME
Summary: ${resume.summary}
Skills: ${resume.skills.join(", ")}
Experience:
${resume.experience}

TARGET JOB
Title: ${listing.title}
Company: ${listing.company}
Description: ${listing.description.slice(0, 4000)}

Produce: a tailored resume (as HTML using <ins>/<del> to mark every change against the original), a cover letter draft addressed to the hiring team at ${listing.company} referencing specific details from the listing, and a short list of the changes you made and why.`,
    toolName: "generate_tailored_materials",
    toolDescription: "Return the tailored resume, cover letter, and change log.",
    schema: {
      type: "object",
      properties: {
        resume_draft: { type: "string" },
        cover_letter_draft: { type: "string" },
        changes_made: { type: "array", items: { type: "string" } },
      },
      required: ["resume_draft", "cover_letter_draft", "changes_made"],
    },
    maxTokens: 2500,
  });
}

function mockTailor(
  resume: ParsedResume,
  listing: NormalizedListing
): TailoredMaterials {
  return {
    resume_draft: `<p>${resume.summary}</p><p>${resume.experience.replace(/\n/g, "<br>")}</p>`,
    cover_letter_draft: `Dear ${listing.company} Hiring Team,\n\nI'm writing to apply for the ${listing.title} role. Based on the listing, my background in ${resume.skills.slice(0, 3).join(", ")} lines up closely with what you're looking for, and I'd welcome the chance to talk through the details.\n\nBest,\n[Your name]\n\n(Mock draft — configure ANTHROPIC_API_KEY for real Claude-tailored content.)`,
    changes_made: [
      "Mock mode — set ANTHROPIC_API_KEY to generate a real tailored diff and cover letter.",
    ],
  };
}
