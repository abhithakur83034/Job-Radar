import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const j = (v: unknown) => JSON.stringify(v);

async function main() {
  console.log("Seeding JobRadar demo data…");

  await db.followUp.deleteMany();
  await db.application.deleteMany();
  await db.tailoredDraft.deleteMany();
  await db.match.deleteMany();
  await db.listing.deleteMany();
  await db.searchProfile.deleteMany();
  await db.resume.deleteMany();
  await db.user.deleteMany();

  const user = await db.user.create({
    data: {
      name: "Abhishek K.",
      email: "abhishek@interbitsolutions.com",
      plan: "free",
      notificationChannel: "email",
      notificationMode: "digest",
    },
  });

  const resume = await db.resume.create({
    data: {
      userId: user.id,
      fileUrl: "resume_abhishek_khandelwal.pdf",
      parsedJson: j({
        summary:
          "Backend engineer with 6 years building web applications, internal tools, and API services across fintech and e-commerce.",
        skills: [
          "Node.js",
          "TypeScript",
          "PostgreSQL",
          "Redis",
          "Distributed systems",
          "REST APIs",
          "System design",
          "React",
        ],
        roles: ["Backend Engineer", "Senior Backend Engineer", "Tech Lead"],
        experience:
          "Experience — Kavach Systems\n" +
          "— Built and maintained REST APIs for the merchant onboarding platform.\n" +
          "— Worked with PostgreSQL and Redis for core transaction storage and caching.\n" +
          "— Participated in on-call rotation and incident response.\n" +
          "— Mentored two junior engineers on system design basics.",
      }),
    },
  });

  const profile = await db.searchProfile.create({
    data: {
      userId: user.id,
      name: "Senior Backend & Staff Roles",
      titles: j(["Senior Backend Engineer", "Staff Software Engineer", "Founding Engineer"]),
      keywords: j(["Node.js", "TypeScript", "Distributed systems", "PostgreSQL"]),
      locations: j(["Remote", "Bengaluru", "San Francisco, CA"]),
      seniority: "senior",
      salaryMin: 150000,
      salaryMax: 220000,
      fitThreshold: 60,
    },
  });

  const listingsData = [
    {
      source: "greenhouse",
      externalId: "vercel-dx-eng",
      title: "Developer Experience Engineer",
      company: "Vercel",
      location: "Remote (Global)",
      description: "Own the DX of our CLI and framework tooling. Node.js, TypeScript, React required.",
      salaryText: "$140k – $175k",
      url: "https://vercel.com/careers",
      foundAt: hoursAgo(0.7),
      fit: 95,
      reason: "5/5 required skills present — ideal fit on stack and seniority",
      matched: ["Node.js", "TypeScript", "React", "REST APIs", "System design"],
      missing: [],
      saved: false,
    },
    {
      source: "greenhouse",
      externalId: "stripe-senior-backend",
      title: "Senior Backend Engineer",
      company: "Stripe",
      location: "Remote (US)",
      description: "Design and scale distributed payment infrastructure processing millions of transactions.",
      salaryText: "$170k – $210k",
      url: "https://stripe.com/jobs",
      foundAt: hoursAgo(2),
      fit: 92,
      reason: "4/5 required skills present, role and location align",
      matched: ["Node.js", "TypeScript", "Distributed systems", "PostgreSQL"],
      missing: ["Payments domain experience"],
      saved: false,
    },
    {
      source: "lever",
      externalId: "notion-product-eng-growth",
      title: "Product Engineer, Growth",
      company: "Notion",
      location: "San Francisco, CA (Hybrid)",
      description: "Build growth experiments across the web app. Strong React/TypeScript background wanted.",
      salaryText: "$150k – $190k",
      url: "https://notion.so/careers",
      foundAt: hoursAgo(5),
      fit: 88,
      reason: "Strong React/TypeScript overlap, seniority matches target",
      matched: ["React", "TypeScript", "Node.js"],
      missing: ["A/B testing infra"],
      saved: false,
    },
    {
      source: "lever",
      externalId: "rippling-backend-payroll",
      title: "Backend Engineer, Payroll",
      company: "Rippling",
      location: "Remote (US)",
      description: "Build payroll processing systems on Node.js and PostgreSQL.",
      salaryText: "$155k – $185k",
      url: "https://rippling.com/careers",
      foundAt: daysAgo(2),
      fit: 84,
      reason: "4/5 required skills present, compensation aligns with target",
      matched: ["Node.js", "PostgreSQL", "REST APIs", "System design"],
      missing: ["Payroll/compliance domain knowledge"],
      saved: true,
    },
    {
      source: "greenhouse",
      externalId: "databricks-staff-data-platform",
      title: "Staff Software Engineer, Data Platform",
      company: "Databricks",
      location: "Remote (Global)",
      description: "Own core data platform services. Deep Spark internals experience required.",
      salaryText: "$190k – $240k",
      url: "https://databricks.com/careers",
      foundAt: hoursAgo(6),
      fit: 71,
      reason: "3/5 required skills present — missing Spark internals experience",
      matched: ["Distributed systems", "System design", "PostgreSQL"],
      missing: ["Apache Spark internals", "JVM performance tuning"],
      saved: false,
    },
    {
      source: "careers_page",
      externalId: "linear-founding-engineer",
      title: "Founding Engineer",
      company: "Linear",
      location: "Remote (US/EU)",
      description: "Early team, full-stack ownership, high autonomy. TypeScript across the stack.",
      salaryText: "$160k – $200k + equity",
      url: "https://linear.app/careers",
      foundAt: daysAgo(1),
      fit: 68,
      reason: "Early-stage exposure is a strong signal, seniority slightly above target",
      matched: ["TypeScript", "Node.js", "React"],
      missing: ["Startup (0-1) experience"],
      saved: false,
    },
  ];

  const matchByCompany: Record<string, string> = {};

  for (const l of listingsData) {
    const listing = await db.listing.create({
      data: {
        source: l.source,
        externalId: l.externalId,
        title: l.title,
        company: l.company,
        location: l.location,
        description: l.description,
        salaryText: l.salaryText,
        url: l.url,
        foundAt: l.foundAt,
      },
    });

    const match = await db.match.create({
      data: {
        listingId: listing.id,
        searchProfileId: profile.id,
        fitScore: l.fit,
        fitReason: l.reason,
        matchedSkills: j(l.matched),
        missingRequirements: j(l.missing),
        saved: l.saved,
        notifiedAt: l.foundAt,
        createdAt: l.foundAt,
      },
    });

    matchByCompany[l.company] = match.id;
  }

  // Tailored draft for the Stripe match, matching the reviewed design.
  await db.tailoredDraft.create({
    data: {
      matchId: matchByCompany["Stripe"],
      resumeDraft:
        "<h4>Summary</h4><ins>Senior</ins> backend engineer with 6 years <ins>designing and scaling distributed payment infrastructure</ins>, <del>building web applications, internal tools, and API services</del> across fintech and e-commerce." +
        "<h4>Experience — Kavach Systems</h4>" +
        "— Built and maintained REST APIs <ins>processing 40k+ transactions/day</ins> for the merchant onboarding platform.<br>" +
        "— <ins>Owned</ins> PostgreSQL and Redis <ins>schema design</ins> for core transaction storage and caching<del>, worked with</del>.<br>" +
        "— <ins>Led</ins> on-call rotation and incident response<del>, participated in</del>.<br>" +
        "— Mentored two junior engineers on <ins>distributed systems and</ins> system design<del> basics</del>.",
      coverLetterDraft:
        "Dear Stripe Hiring Team,\n\nI'm writing to apply for the Senior Backend Engineer role. Over the past 6 years at Kavach Systems I've built and scaled REST APIs handling 40k+ transactions/day, owned our PostgreSQL/Redis schema design for transaction storage, and led incident response during on-call rotations — work that maps closely to what you're describing for this role.\n\nI'd welcome the chance to talk through how that experience applies to Stripe's payment infrastructure.\n\nBest,\nAbhishek Khandelwal",
      changesMade: j([
        "Added \"Senior\" and reframed summary around distributed payment infrastructure to mirror the listing's core requirement.",
        "Quantified API impact (40k+ transactions/day) using a figure already present in your original bullet notes.",
        "Reworded ownership language (\"Owned\", \"Led\") to match seniority level expected for this role — no new claims added.",
      ]),
    },
  });

  // Applications + follow-up state, matching the reviewed Tracker design.
  await db.application.create({
    data: {
      matchId: matchByCompany["Stripe"],
      status: "applied",
      appliedAt: daysAgo(17),
      lastUpdateAt: daysAgo(9), // >= 7 days ago -> shows as "Follow-up due"
    },
  });
  await db.application.create({
    data: {
      matchId: matchByCompany["Databricks"],
      status: "interviewing",
      appliedAt: daysAgo(11),
      lastUpdateAt: daysAgo(3),
    },
  });
  await db.application.create({
    data: {
      matchId: matchByCompany["Vercel"],
      status: "applied",
      appliedAt: daysAgo(2),
      lastUpdateAt: daysAgo(2),
    },
  });
  await db.application.create({
    data: {
      matchId: matchByCompany["Notion"],
      status: "offer",
      appliedAt: daysAgo(24),
      lastUpdateAt: daysAgo(1),
    },
  });
  await db.application.create({
    data: {
      matchId: matchByCompany["Rippling"],
      status: "interviewing",
      appliedAt: daysAgo(9),
      lastUpdateAt: daysAgo(5),
    },
  });
  await db.application.create({
    data: {
      matchId: matchByCompany["Linear"],
      status: "applied",
      appliedAt: daysAgo(5),
      lastUpdateAt: daysAgo(5),
    },
  });

  console.log(`Seeded user ${user.email}, résumé ${resume.fileUrl}, ${listingsData.length} listings/matches, 1 tailored draft, 6 applications.`);
}

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}
function daysAgo(d: number) {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
