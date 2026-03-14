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
  let newCode = oldCode;
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

const roomStates = new Map<string, string>(); // roomId -> current code
const userStates = new Map<
  string,
  { userId: string; name: string; color: string; roomId: string }
>(); // socketId -> user data

//Socketio manages Room <-> socket(so when you emit with roomid , it will know which socketid to send based on roomid) and we are managing roomId <-> code and socketId <-> user data

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join_room", (data) => {
    const { roomId, user } = data;
    socket.join(roomId); //socket io is mangaing Room internnaly (room <-> scoket)

    const userData = {
      userId: socket.id,
      name: user,
      color: ["#4ade80", "#60a5fa", "#f472b6", "#a78bfa", "#34d399", "#fb923c"][
        Math.floor(Math.random() * 6)
      ],
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
  });

  socket.on(
    "cursor_move",
    (data: { position: { lineNumber: number; column: number } }) => {
      const user = userStates.get(socket.id);
      if (!user) {
        console.error(`User not found for socket ${socket.id}`);
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
    },
  );

  socket.on(
    "selection_change",
    (data: {
      selection: {
        startLineNumber: number;
        startColumn: number;
        endLineNumber: number;
        endColumn: number;
      };
    }) => {
      const user = userStates.get(socket.id);
      if (!user) {
        console.error(`User not found for socket ${socket.id}`);
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
    },
  );

  socket.on("code_delta", (data) => {
    const user = userStates.get(socket.id);
    if (!user) {
      console.error(`User not found for socket ${socket.id}`);
      return;
    }
    const { changes } = data;
    const currentCode = roomStates.get(user.roomId) || "";
    const updatedCode = applyChanges(currentCode, changes);

    roomStates.set(user.roomId, updatedCode);
    socket.to(user.roomId).emit("receive_delta", { changes });

    socket.to(user.roomId).emit("user_status_change", {
      userId: socket.id,
    });
  });

  socket.on("request_full_sync", (roomId) => {
    socket.join(roomId);
    socket.emit("init_code", roomStates.get(roomId) || "");
  });

  socket.on("disconnect", () => {
    const user = userStates.get(socket.id);
    if (!user) return;

    const { roomId } = user;
    socket.to(roomId).emit("user_left", socket.id);
    userStates.delete(socket.id);

    const clientsInRoom = io.sockets.adapter.rooms.get(roomId);
    if (!clientsInRoom || clientsInRoom.size === 0) {
      roomStates.delete(roomId);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
