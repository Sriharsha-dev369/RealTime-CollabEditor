import type { Server, Socket } from "socket.io";
import {
  addUser,
  getUser,
  removeUser,
  getUsersInRoom,
  assignRandomColor,
} from "../state/users.js";
import {
  getOrCreateRoom,
  getRoomCode,
  setRoomCode,
  deleteRoom,
} from "../state/rooms.js";
import { applyChanges } from "../utils/applyChanges.js";

export function registerSocketHandlers(io: Server, socket: Socket): void {
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

      socket.join(roomId);

      const userData = {
        userId: socket.id,
        name: user.trim(),
        color: assignRandomColor(),
        roomId: roomId,
      };

      addUser(socket.id, userData);

      const code = getOrCreateRoom(roomId);
      socket.emit("init_code", code);

      socket.to(roomId).emit("new_user_joined", userData);

      const usersInRoom = getUsersInRoom(roomId);
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
        const user = getUser(socket.id);
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
        const user = getUser(socket.id);
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
      const user = getUser(socket.id);
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

      const currentCode = getRoomCode(user.roomId);
      const updatedCode = applyChanges(currentCode, changes);

      if (updatedCode !== currentCode) {
        setRoomCode(user.roomId, updatedCode);
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
      const code = getRoomCode(roomId);
      socket.emit("init_code", code);
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
      const user = getUser(socket.id);
      if (!user) return;

      const { roomId } = user;
      socket.to(roomId).emit("user_left", socket.id);
      removeUser(socket.id);

      const clientsInRoom = io.sockets.adapter.rooms.get(roomId);
      if (!clientsInRoom || clientsInRoom.size === 0) {
        deleteRoom(roomId);
        console.log(`Room ${roomId} cleaned up (no users left)`);
      }
      console.log(`User ${socket.id} disconnected from room ${roomId}`);
    } catch (error) {
      console.error("Error in disconnect handler:", error);
    }
  });
}
