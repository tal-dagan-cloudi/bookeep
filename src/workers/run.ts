// Worker runner — start with: pnpm workers
import { config } from "dotenv"

// Load .env.local (same as Next.js)
config({ path: ".env.local" })

console.info("Starting Bookeep workers...")

// Import workers to start them
import("./document-process")
  .then(() => console.info("Document process worker started"))
  .catch((err) => console.error("Failed to start document process worker:", err))

import("./email-scan")
  .then(() => console.info("Email scan worker started"))
  .catch((err) => console.error("Failed to start email scan worker:", err))

// Keep process alive
setInterval(() => {}, 1 << 30)

process.on("SIGTERM", () => {
  console.info("Shutting down workers...")
  process.exit(0)
})

process.on("SIGINT", () => {
  console.info("Shutting down workers...")
  process.exit(0)
})
