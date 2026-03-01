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
const userStates = new Map<
  string,
  { userId: string; name: string; color: string; roomId: string }
>();

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join_room", (data) => {
    const { roomId, user } = data;
    socket.join(roomId);

    const userData = {
      userId: socket.id,
      name: user,
      color: ["#ff4757", "#2ed573", "#1e90ff", "#ffa502", "#e056fd"][
        Math.floor(Math.random() * 5)
      ],
      roomId: roomId,
    };

    userStates.set(socket.id, userData);

    if (!roomStates.has(roomId)) {
      roomStates.set(roomId, "// Welcome to " + roomId);
    }

    socket.emit("init_code", roomStates.get(roomId));

    socket.to(roomId).emit("new_user_joined", userData);

    const usersInRoom = Array.from(userStates.values())
      .filter((u) => u.roomId === roomId)
      .map((u) => u.name);

    socket.emit("current_user_list", usersInRoom);
  });

  //   socket.on("users_list", (roomId: string) => {
  //   const usersInRoom = Array.from(userStates.values())
  //     .filter(u => u.roomId === roomId);

  //   io.to(roomId).emit("users_list", usersInRoom);
  // });

  socket.on(
    "cursor_move",
    (data: {
      roomId: string;
      position: { lineNumber: number; column: number };
    }) => {
      const user = userStates.get(socket.id);
      if (user) {
        socket.to(data.roomId).emit("receive_cursor", {
          userId: socket.id,
          position: data.position,
          color: user.color,
          name: user.name,
        });
      }
    },
  );

  socket.on(
    "selection_change",
    (data: {
      roomId: string;
      selection: {
        startLineNumber: number;
        startColumn: number;
        endLineNumber: number;
        endColumn: number;
      };
    }) => {
      const user = userStates.get(socket.id);
      if (user) {
        socket.to(data.roomId).emit("receive_selection", {
          userId: socket.id,
          selection: data.selection,
          color: user.color,
          name: user.name,
        });
      }
    },
  );

  socket.on("code_delta", (data) => {
    const { roomId, changes } = data;
    const currentCode = roomStates.get(roomId) || "";
    const updatedCode = applyChanges(currentCode, changes);

    roomStates.set(roomId, updatedCode);
    socket.to(roomId).emit("receive_delta", { changes });
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

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
