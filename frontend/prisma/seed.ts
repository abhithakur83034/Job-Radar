import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("Resetting database — clearing all records without seeding dummy job data...");

  await db.followUp.deleteMany();
  await db.application.deleteMany();
  await db.tailoredDraft.deleteMany();
  await db.match.deleteMany();
  await db.listing.deleteMany();
  await db.searchProfile.deleteMany();
  await db.resume.deleteMany();
  await db.user.deleteMany();

  console.log("Database reset complete. Zero dummy job data remaining.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
