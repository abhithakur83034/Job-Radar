import { RadarHero } from "@/components/RadarHero";
import { MatchFeedClient } from "@/components/MatchFeedClient";
import { FeedAutoRefresh } from "@/components/FeedAutoRefresh";
import { getMatchFeed, getDemoUser, getJobSources } from "@/lib/queries";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const sessionUser = await getSessionUser();
  const user = sessionUser ?? (await getDemoUser());
  const [matches, { sources, labels }] = await Promise.all([getMatchFeed(user?.id), getJobSources()]);

  const newToday = matches.filter((m: any) => {
    const hoursOld = (Date.now() - new Date(m.createdAt).getTime()) / 36e5;
    return hoursOld < 24 && m.fitScore >= 85;
  }).length;

  const cardData = matches.map((m: any) => ({
    id: m.id,
    fitScore: m.fitScore,
    fitReason: m.fitReason,
    saved: m.saved,
    listing: {
      title: m.listing.title,
      company: m.listing.company,
      location: m.listing.location,
      salaryText: m.listing.salaryText,
      source: m.listing.source,
      url: m.listing.url,
      remoteType: m.listing.remoteType,
      foundAt: m.listing.foundAt.toISOString(),
    },
  }));

  // Configured background sources + the user's company boards
  const sourceCount = sources.filter((s) => s.configured && s.id !== "boards").length + 1;

  return (
    <div>
      <RadarHero newMatchCount={newToday} sourceCount={sourceCount} sources={sources} />
      <MatchFeedClient matches={cardData} labels={labels} />
      <FeedAutoRefresh />
    </div>
  );
}
