import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const server = createServer(app);
const PORT = process.env.PORT || 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST"],
  },
});

function applyChanges(oldCode: string, changes: any[]): string {
  if (!Array.isArray(changes)) {
    console.error("Invalid changes: expected array", changes);
    return oldCode;
  }

  try {
    let newCode = oldCode;
    const sortedChanges = [...changes].sort(
      (a, b) => b.rangeOffset - a.rangeOffset,
    );

    for (const change of sortedChanges) {
      if (
        typeof change.rangeOffset !== "number" ||
        typeof change.rangeLength !== "number" ||
        typeof change.text !== "string"
      ) {
        console.error("Invalid change object:", change);
        continue;
      }

      const { rangeOffset, rangeLength, text } = change;
      if (rangeOffset < 0 || rangeOffset > newCode.length) {
        console.error(
          `Invalid rangeOffset: ${rangeOffset}, code length: ${newCode.length}`,
        );
        continue;
      }

      newCode =
        newCode.substring(0, rangeOffset) +
        text +
        newCode.substring(rangeOffset + rangeLength);
    }
    return newCode;
  } catch (error) {
    console.error("Error applying changes:", error);
    return oldCode;
  }
}

const roomStates = new Map<string, string>(); // roomId -> current code
const userStates = new Map<
  string,
  { userId: string; name: string; color: string; roomId: string }
>(); // socketId -> user data

//Socketio manages Room <-> socket(so when you emit with roomid , it will know which socketid to send based on roomid) and we are managing roomId <-> code and socketId <-> user data

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join_room", (data) => {
    try {
      if (!data || typeof data !== "object") {
        console.error("Invalid join_room data:", data);
        socket.emit("error", { message: "Invalid join data" });
        return;
      }

      const { roomId, user } = data;

      if (!roomId || typeof roomId !== "string" || roomId.trim().length === 0) {
        console.error("Invalid roomId:", roomId);
        socket.emit("error", { message: "Invalid room ID" });
        return;
      }

      if (!user || typeof user !== "string" || user.trim().length === 0) {
        console.error("Invalid user name:", user);
        socket.emit("error", { message: "Invalid user name" });
        return;
      }

      socket.join(roomId); //socket io is mangaing Room internnaly (room <-> scoket)

      const userData = {
        userId: socket.id,
        name: user.trim(),
        color: [
          "#4ade80",
          "#60a5fa",
          "#f472b6",
          "#a78bfa",
          "#34d399",
          "#fb923c",
        ][Math.floor(Math.random() * 6)],
        roomId: roomId,
      };

      userStates.set(socket.id, userData);

      if (!roomStates.has(roomId)) {
        roomStates.set(roomId, "// Welcome to " + roomId);
      }

      socket.emit("init_code", roomStates.get(roomId));

      socket.to(roomId).emit("new_user_joined", userData);

      const usersInRoom = Array.from(userStates.values()).filter(
        (u) => u.roomId === roomId,
      );

      socket.emit("current_user_list", usersInRoom);
      console.log(`User ${user} joined room ${roomId}`);
    } catch (error) {
      console.error("Error in join_room handler:", error);
      socket.emit("error", { message: "Failed to join room" });
    }
  });

  socket.on(
    "cursor_move",
    (data: { position?: { lineNumber: number; column: number } }) => {
      try {
        const user = userStates.get(socket.id);
        if (!user) {
          console.error(`User not found for socket ${socket.id}`);
          return;
        }

        if (!data || !data.position) {
          console.error("Invalid cursor_move data:", data);
          return;
        }

        const { lineNumber, column } = data.position;
        if (
          typeof lineNumber !== "number" ||
          typeof column !== "number" ||
          lineNumber < 0 ||
          column < 0
        ) {
          console.error("Invalid position values:", data.position);
          return;
        }

        socket.to(user.roomId).emit("receive_cursor", {
          userId: socket.id,
          position: data.position,
          color: user.color,
          name: user.name,
        });
        socket.to(user.roomId).emit("user_status_change", {
          userId: socket.id,
          status: "viewing",
        });
      } catch (error) {
        console.error("Error in cursor_move handler:", error);
      }
    },
  );

  socket.on(
    "selection_change",
    (data: { selection?: Record<string, number> }) => {
      try {
        const user = userStates.get(socket.id);
        if (!user) {
          console.error(`User not found for socket ${socket.id}`);
          return;
        }

        if (!data || !data.selection) {
          console.error("Invalid selection_change data:", data);
          return;
        }

        const { startLineNumber, startColumn, endLineNumber, endColumn } =
          data.selection as Record<string, number>;
        if (
          typeof startLineNumber !== "number" ||
          typeof startColumn !== "number" ||
          typeof endLineNumber !== "number" ||
          typeof endColumn !== "number" ||
          startLineNumber < 0 ||
          startColumn < 0 ||
          endLineNumber < 0 ||
          endColumn < 0
        ) {
          console.error("Invalid selection values:", data.selection);
          return;
        }

        socket.to(user.roomId).emit("receive_selection", {
          userId: socket.id,
          selection: data.selection,
          color: user.color,
          name: user.name,
        });
        socket.to(user.roomId).emit("user_status_change", {
          userId: socket.id,
          status: "viewing",
        });
      } catch (error) {
        console.error("Error in selection_change handler:", error);
      }
    },
  );

  socket.on("code_delta", (data) => {
    try {
      const user = userStates.get(socket.id);
      if (!user) {
        console.error(`User not found for socket ${socket.id}`);
        return;
      }

      if (!data || !Array.isArray(data.changes)) {
        console.error("Invalid code_delta data:", data);
        return;
      }

      const { changes } = data;
      if (changes.length === 0) {
        return; // No changes to apply
      }

      const currentCode = roomStates.get(user.roomId) || "";
      const updatedCode = applyChanges(currentCode, changes);

      if (updatedCode !== currentCode) {
        roomStates.set(user.roomId, updatedCode);
        socket.to(user.roomId).emit("receive_delta", { changes });
      }

      socket.to(user.roomId).emit("user_status_change", {
        userId: socket.id,
      });
    } catch (error) {
      console.error("Error in code_delta handler:", error);
    }
  });

  socket.on("request_full_sync", (roomId) => {
    try {
      if (!roomId || typeof roomId !== "string" || roomId.trim().length === 0) {
        console.error("Invalid roomId in request_full_sync:", roomId);
        socket.emit("error", { message: "Invalid room ID for sync" });
        return;
      }
      socket.join(roomId);
      const code = roomStates.get(roomId);
      socket.emit("init_code", code || "");
    } catch (error) {
      console.error("Error in request_full_sync handler:", error);
      socket.emit("error", { message: "Failed to sync code" });
    }
  });

  socket.on("error", (error) => {
    console.error("Socket error for client " + socket.id + ":", error);
  });

  socket.on("disconnect", () => {
    try {
      const user = userStates.get(socket.id);
      if (!user) return;

      const { roomId } = user;
      socket.to(roomId).emit("user_left", socket.id);
      userStates.delete(socket.id);

      const clientsInRoom = io.sockets.adapter.rooms.get(roomId);
      if (!clientsInRoom || clientsInRoom.size === 0) {
        roomStates.delete(roomId);
        console.log(`Room ${roomId} cleaned up (no users left)`);
      }
      console.log(`User ${socket.id} disconnected from room ${roomId}`);
    } catch (error) {
      console.error("Error in disconnect handler:", error);
    }
  });
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
