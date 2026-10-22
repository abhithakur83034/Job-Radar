import { Suspense } from "react";
import { getDefaultDraftMatch, getMatchWithDraft, getResumeForUser } from "@/lib/queries";
import { FitBadge } from "@/components/FitBadge";
import { DraftActions } from "@/components/DraftActions";
import { DraftEditors } from "@/components/DraftEditors";
import { DraftGenerateButton } from "@/components/DraftGenerateButton";
import { MarkAppliedButton } from "@/components/MarkAppliedButton";
import { resolveDiffToPlainText } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DraftsPage({
  searchParams,
}: {
  searchParams: { match?: string };
}) {
  const match = searchParams.match
    ? await getMatchWithDraft(searchParams.match)
    : await getDefaultDraftMatch();

  if (!match) {
    return (
      <div className="rounded-card border border-dashed border-border p-8 text-center text-ink-muted">
        No matches yet. Add listings or sync job sources to generate tailored drafts.
      </div>
    );
  }

  const draft = match.tailoredDraft;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-[19px]">
          <span className="font-display font-bold">
            Tailored for <b className="text-accent-soft-ink">{match.listing.title}</b> at {match.listing.company}
          </span>
          <FitBadge score={match.fitScore} size="sm" />
        </div>
        {draft && (
          <div className="flex flex-wrap gap-2.5">
            <DraftActions
              listingUrl={match.listing.url}
              resumeText={resolveDiffToPlainText(draft.resumeDraft)}
              coverLetterText={draft.coverLetterDraft}
            />
            <MarkAppliedButton matchId={match.id} alreadyApplied={Boolean(match.application)} />
          </div>
        )}
      </div>

      {!draft ? (
        <DraftGenerateButton matchId={match.id} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-ink-muted">
                Original résumé
              </div>
              <div className="doc-pane mono max-h-[420px] overflow-auto rounded-card border border-border bg-surface p-5 text-[12.8px] leading-[1.75]">
                {match.tailoredDraft ? (
                  // Streams in after the rest of the page instead of blocking it
                  <Suspense fallback={<span className="text-ink-muted">Loading résumé…</span>}>
                    <OriginalResumePreview matchId={match.id} />
                  </Suspense>
                ) : null}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-ink-muted">
                Tailored for this role
              </div>
              <div
                className="doc-pane mono max-h-[420px] overflow-auto rounded-card border border-border bg-surface p-5 text-[12.8px] leading-[1.75]"
                // The tailored draft is our own Claude-generated HTML (ins/del markup
                // only) — not third-party user input — so rendering it directly is
                // acceptable here. Sanitize with e.g. DOMPurify before shipping this
                // to production if the model or prompt surface ever changes.
                dangerouslySetInnerHTML={{ __html: draft.resumeDraft }}
              />
            </div>
          </div>

          <div className="mt-4 rounded-card border border-border bg-surface p-5">
            <div className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-ink-muted">
              Changes made
            </div>
            <ul className="list-disc space-y-1.5 pl-5 text-[12.8px] marker:text-success">
              {(Array.isArray(draft.changesMade)
                ? draft.changesMade
                : typeof draft.changesMade === "string"
                ? (JSON.parse(draft.changesMade || "[]") as string[])
                : []
              ).map((c: string, i: number) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>

          <DraftEditors
            initialResume={resolveDiffToPlainText(draft.resumeDraft)}
            initialCoverLetter={draft.coverLetterDraft}
          />
        </>
      )}
    </div>
  );
}

async function OriginalResumePreview({ matchId: _matchId }: { matchId: string }) {
  const resume = await getResumeForUser();
  if (!resume) return <span className="text-ink-muted">No résumé on file.</span>;
  const parsed = resume.parsedData || { summary: "", experience: "" };
  return (
    <>
      <p>{parsed.summary || "Candidate resume on file with verified technical skills."}</p>
      <p className="mt-3 whitespace-pre-line">{parsed.experience || "3+ years technical experience."}</p>
    </>
  );
}
