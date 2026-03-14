import { config } from "./config.js";
import prisma from "./db.js";

async function main() {
  console.log("EnergyBot starting...");
  console.log(`Database URL: ${config.databaseUrl}`);

  await prisma.$connect();
  console.log("Database connected");

  await prisma.$disconnect();
  console.log("Shutdown complete");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
