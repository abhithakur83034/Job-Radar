import { callClaudeForJson, isClaudeConfigured } from "./claude";
import type { MatchScore, ParsedResume, SearchProfileInput } from "./types";
import type { NormalizedListing } from "./connectors/types";

// "10.1 Match Scoring Prompt" — compares a user's parsed resume/skills and
// search criteria against a normalized listing, returning fit_score (0-100),
// fit_reason, matched_skills, and missing_requirements so the user can see
// exactly why a job scored the way it did rather than trusting an opaque number.
export async function scoreListing(
  resume: ParsedResume,
  profile: SearchProfileInput,
  listing: NormalizedListing
): Promise<MatchScore> {
  if (!isClaudeConfigured()) {
    return mockScore(resume, profile, listing);
  }

  return callClaudeForJson<MatchScore>({
    system:
      "You are JobRadar's match-scoring engine. Score how well a job listing fits a candidate's resume and search criteria. Be specific and honest — do not inflate scores. Base matched_skills strictly on skills that literally appear in the resume, and missing_requirements on requirements in the listing that the resume does not evidence.",
    prompt: `CANDIDATE RESUME
Summary: ${resume.summary}
Skills: ${resume.skills.join(", ")}
Roles held: ${resume.roles.join(", ")}
Experience:
${resume.experience}

SEARCH CRITERIA
Target titles: ${profile.titles.join(", ")}
Keywords: ${profile.keywords.join(", ")}
Locations: ${profile.locations.join(", ")}
Seniority: ${profile.seniority}
Salary range: ${profile.salaryMin ?? "any"}–${profile.salaryMax ?? "any"}

JOB LISTING
Title: ${listing.title}
Company: ${listing.company}
Location: ${listing.location}
Description: ${listing.description.slice(0, 4000)}`,
    toolName: "score_match",
    toolDescription: "Return the fit score and reasoning for this listing.",
    schema: {
      type: "object",
      properties: {
        fit_score: { type: "integer", minimum: 0, maximum: 100 },
        fit_reason: { type: "string" },
        matched_skills: { type: "array", items: { type: "string" } },
        missing_requirements: { type: "array", items: { type: "string" } },
      },
      required: ["fit_score", "fit_reason", "matched_skills", "missing_requirements"],
    },
  });
}

// Deterministic offline fallback: keyword-overlap scoring so the product is
// still explorable without an ANTHROPIC_API_KEY configured.
function mockScore(
  resume: ParsedResume,
  profile: SearchProfileInput,
  listing: NormalizedListing
): MatchScore {
  const haystack = `${listing.title} ${listing.description}`.toLowerCase();
  const candidateTerms = [...resume.skills, ...profile.keywords];

  const matched = candidateTerms.filter((term) =>
    haystack.includes(term.toLowerCase())
  );
  const missing = profile.keywords.filter(
    (term) => !haystack.includes(term.toLowerCase())
  );

  const titleAligns = profile.titles.some((t) =>
    listing.title.toLowerCase().includes(t.toLowerCase().split(" ")[0])
  );
  const locationAligns = profile.locations.some((l) =>
    listing.location.toLowerCase().includes(l.toLowerCase())
  );

  const base = candidateTerms.length
    ? Math.round((matched.length / candidateTerms.length) * 70)
    : 40;
  const bonus = (titleAligns ? 15 : 0) + (locationAligns ? 15 : 0);
  const fit_score = Math.max(5, Math.min(99, base + bonus));

  return {
    fit_score,
    fit_reason: `${matched.length}/${candidateTerms.length || 1} tracked skills present${
      titleAligns ? ", title aligns" : ""
    }${locationAligns ? ", location aligns" : ""} (mock score — set ANTHROPIC_API_KEY for real Claude scoring).`,
    matched_skills: matched,
    missing_requirements: missing,
  };
}
