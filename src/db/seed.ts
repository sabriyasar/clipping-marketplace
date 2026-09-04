import "dotenv/config";
import { db } from "./index";
import { users } from "./schema";

const seedUsers = [
  {
    email: "admin@example.com",
    role: "admin" as const,
  },
  {
    email: "creator@example.com",
    role: "creator" as const,
  },
];

async function seed() {
  for (const user of seedUsers) {
    await db
      .insert(users)
      .values(user)
      .onConflictDoUpdate({
        target: users.email,
        set: {
          role: user.role,
        },
      });
  }

  console.log("Seed completed.");
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
