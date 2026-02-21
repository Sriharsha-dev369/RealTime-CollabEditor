import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

function applyChanges(oldCode: string, changes: any[]): string {
  let newCode = oldCode;
  // We sort changes in reverse to avoid index shifting issues during a single batch
  const sortedChanges = [...changes].sort(
    (a, b) => b.rangeOffset - a.rangeOffset,
  );

  for (const change of sortedChanges) {
    const { rangeOffset, rangeLength, text } = change;
    newCode =
      newCode.substring(0, rangeOffset) +
      text +
      newCode.substring(rangeOffset + rangeLength);
  }
  return newCode;
}

const roomStates = new Map<string, string>();

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join_room", (roomId: string) => {
    socket.join(roomId);

    // Check if room exists, if not initialize
    if (!roomStates.has(roomId)) {
      roomStates.set(roomId, "// Welcome to room: " + roomId);
    }

    const currentRoomCode = roomStates.get(roomId);
    // Send the LATEST state to the user who just joined
    socket.emit("init_code", currentRoomCode);
  });

  // server.ts
  socket.on("code_delta", (data) => {
    const { roomId, changes } = data;

    // 1. Get what we currently have
    const currentCode = roomStates.get(roomId) || "";

    // 2. Calculate the NEW full string
    const updatedCode = applyChanges(currentCode, changes);

    // 3. IMPORTANT: Save this back to the Map!
    // If you skip this, new users will only ever see the original welcome message.
    roomStates.set(roomId, updatedCode);

    // 4. Send the small change to everyone else
    socket.to(roomId).emit("receive_delta", { changes });
  });

  // Add a heart-beat or a "version" check
  socket.on("request_full_sync", (roomId: string) => {
    const currentCode = roomStates.get(roomId) || "";
    // Send only to the requester to save bandwidth
    socket.emit("init_code", currentCode);
  });

  socket.on("disconnect", () => {
    // Check if the room the user was in is now empty
    for (const [roomId, state] of roomStates) {
      const clientsInRoom = io.sockets.adapter.rooms.get(roomId);
      if (!clientsInRoom || clientsInRoom.size === 0) {
        console.log(`Cleaning up empty room: ${roomId}`);
        roomStates.delete(roomId); // Free up memory
      }
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
