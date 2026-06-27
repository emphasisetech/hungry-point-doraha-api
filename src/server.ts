const dns = require('node:dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import { instrument } from "@socket.io/admin-ui";
import { config } from "./config";
import { connectDb } from "./db";
import { errorHandler } from "./middleware";
import { routes } from "./routes";

async function bootstrap() {
  await connectDb();
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: [config.clientUrl, "https://admin.socket.io"], credentials: true }
  });

  instrument(io, { auth: false, mode: "development" });
  app.use(helmet());
  app.use(cors({ origin: config.clientUrl, credentials: true }));
  app.use(express.json({ limit: "5mb" }));
  app.use(morgan("dev"));
  app.use(rateLimit({ windowMs: 60_000, limit: 180 }));
  app.use("/api", routes(io));
  app.use(errorHandler);

  io.on("connection", (socket) => {
    socket.emit("connected", { id: socket.id });
  });

  server.listen(config.port, () => console.log(`API ready on http://localhost:${config.port}`));
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
