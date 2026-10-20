import { RadarHero } from "@/components/RadarHero";
import { MatchFeedClient } from "@/components/MatchFeedClient";
import { getMatchFeed, getDemoUser } from "@/lib/queries";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const sessionUser = await getSessionUser();
  const demoUser = await getDemoUser();
  const user = sessionUser ?? demoUser;
  const matches = await getMatchFeed(user?.id);

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
      foundAt: m.listing.foundAt.toISOString(),
    },
  }));

  const uniqueSources = new Set(cardData.map((c: any) => c.listing.source)).size;

  return (
    <div>
      <RadarHero newMatchCount={newToday} sourceCount={uniqueSources > 0 ? uniqueSources : 1} />
      <MatchFeedClient matches={cardData} />
    </div>
  );
}
