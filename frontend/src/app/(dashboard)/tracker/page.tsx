import { getApplications } from "@/lib/queries";
import { StatusPill } from "@/components/StatusPill";
import { displayStatus, daysSince } from "@/lib/tracker";
import { ApplicationRowActions } from "./ApplicationRowActions";

export const revalidate = 30;

export default async function TrackerPage() {
  const applications = await getApplications();

  const counts = { applied: 0, interviewing: 0, followup: 0, offer: 0 };
  for (const app of applications) {
    const status = displayStatus(app) as keyof typeof counts;
    if (status in counts) counts[status]++;
  }

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Applied" value={counts.applied} />
        <Stat label="Interviewing" value={counts.interviewing} />
        <Stat label="Follow-up due" value={counts.followup} tone="danger" />
        <Stat label="Offer" value={counts.offer} tone="success" />
      </div>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Applied</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last update</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {applications.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-muted">
                  No applications tracked yet. Mark matches as applied to track responses and follow-ups.
                </td>
              </tr>
            ) : (
              applications.map((app) => {
              const status = displayStatus(app);
              const days = daysSince(app.lastUpdateAt);
              return (
                <tr key={app.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3.5">
                    <div className="font-display text-[13.5px] font-bold">{app.match.listing.title}</div>
                    <div className="text-[12px] text-ink-muted">{app.match.fitScore}% fit</div>
                  </td>
                  <td className="px-4 py-3.5">{app.match.listing.company}</td>
                  <td className="mono px-4 py-3.5">
                    {new Date(app.appliedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusPill status={status} />
                  </td>
                  <td className={`mono px-4 py-3.5 ${status === "followup" ? "text-danger" : ""}`}>
                    {days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`}
                  </td>
                  <td className="px-4 py-3.5">
                    <ApplicationRowActions
                      applicationId={app.id}
                      isDue={status === "followup"}
                      status={app.status}
                      appliedAt={new Date(app.appliedAt).toLocaleDateString()}
                      lastUpdateAt={new Date(app.lastUpdateAt).toLocaleDateString()}
                    />
                  </td>
                </tr>
              );
            }))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "danger" | "success" }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="mono text-2xl font-bold">{value}</div>
      <div className={`mt-0.5 text-[12px] ${tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-ink-muted"}`}>
        {label}
      </div>
    </div>
  );
}
