import mongoose from "mongoose";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

try {
  await mongoose.connect(env.mongoUri);
  logger.info({
    message: "Connected to MongoDB",
    metadata: { mongoUri: env.mongoUri },
  });

  const app = createApp();
  app.listen(env.port, () => {
    logger.info({
      message: "Event Service listening",
      metadata: { port: env.port },
    });
  });
} catch (err) {
  logger.error({ message: "Failed to start service", metadata: { error: err.message } });
  process.exit(1);
}
