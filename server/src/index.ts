import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import cors from "cors";
import { PORT, CLIENT_ORIGIN } from "./config.js";
import { registerRoomHandler } from "./socket/handlers/roomHandler.js";
import { registerFileHandler } from "./socket/handlers/fileHandler.js";
import { registerPresenceHandler } from "./socket/handlers/presenceHandler.js";
import { registerDisconnectHandler } from "./socket/handlers/disconnectHandler.js";

const app = express();
app.use(cors());

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST", "DELETE", "UPDATE"],
  },
});

io.on("connection", (socket) => {
  registerRoomHandler(io, socket);
  registerFileHandler(io, socket);
  registerPresenceHandler(io, socket);
  registerDisconnectHandler(io, socket);
});

server.on("error", (error) => {
  console.error("Server error:", error);
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});
