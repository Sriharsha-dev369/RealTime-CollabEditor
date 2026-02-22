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

const roomStates = new Map<string, string>(); //we store this because , we cant trust Cleint.
const userStates = new Map(); // socket.id -> { userData, roomId }

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join_room", (roomId) => {
    socket.join(roomId);

    const userData = {
      userId: socket.id,
      name: `User-${socket.id.substring(0, 4)}`,
      color: ["#ff4757", "#2ed573", "#1e90ff", "#ffa502", "#e056fd"][
        Math.floor(Math.random() * 5)
      ],
    };

    // Store the roomId so we know where they are during disconnect
    userStates.set(socket.id, { userData, roomId });

    if (!roomStates.has(roomId)) {
      roomStates.set(roomId, "// Welcome to " + roomId);
    }

    socket.emit("init_code", roomStates.get(roomId));

    // FIX: Match the event name the client is listening for
    socket.to(roomId).emit("new_user_joined", { userId: socket.id });
  });

  // server.ts
  socket.on(
    "cursor_move",
    (data: {
      roomId: string;
      position: { lineNumber: number; column: number };
    }) => {
      const userData = userStates.get(socket.id);
      if (userData) {
        socket.to(data.roomId).emit("receive_cursor", {
          userId: socket.id,
          position: data.position,
          color: userData.color,
          name: userData.name,
        });
      }
    },
  );

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

  socket.on("request_full_sync", (roomId) => {
    // 1. Safety Check: Make sure the socket is actually in the room
    // (In case the server restarted or the socket's session was cleared)
    socket.join(roomId);

    // 2. Get the current master copy of the code
    const currentCode = roomStates.get(roomId) || "";

    // 3. Send ONLY to this specific user
    // Using socket.emit (instead of io.to(roomId)) avoids flickering other users
    socket.emit("init_code", currentCode);

    console.log(`Syncing user ${socket.id} for room ${roomId}`);
  });

  socket.on("disconnect", () => {
    const session = userStates.get(socket.id);
    if (!session) return;

    const { roomId } = session;

    // 2. Focused Broadcast: Only tell the specific room
    socket.to(roomId).emit("user_left", socket.id);
    userStates.delete(socket.id);

    // 3. Focused Cleanup: Only check the room the user was actually in
    const clientsInRoom = io.sockets.adapter.rooms.get(roomId);
    if (!clientsInRoom || clientsInRoom.size === 0) {
      console.log(`Cleaning up empty room: ${roomId}`);
      roomStates.delete(roomId);
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
