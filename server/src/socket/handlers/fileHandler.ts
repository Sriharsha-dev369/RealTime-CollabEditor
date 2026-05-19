import type { Server, Socket } from "socket.io";
import { CLIENT_EVENTS, SERVER_EVENTS } from "../events.js";
import { socketToUser, socketToRoom } from "../../store/index.js";
import * as fileManager from "../../modules/file/filesManager.js";

export function registerFileHandler(io: Server, socket: Socket): void {
  socket.on(
    CLIENT_EVENTS.FILE_UPDATE,
    ({ fileId, changes }: { fileId: string; changes: unknown[] }) => {
      const userId = socketToUser.get(socket.id);
      const roomId = socketToRoom.get(socket.id);
      if (!userId || !roomId) return;

      const file = fileManager.updateFile(roomId, fileId, changes);
      if (!file) return;

      // Broadcast changes to room (excluding sender — client applies its own changes)
      socket.to(roomId).emit(SERVER_EVENTS.FILE_UPDATED, {
        fileId,
        changes,
        userId,
      });
    },
  );

  socket.on(
    CLIENT_EVENTS.FILE_CREATE,
    ({ name, language }: { name: string; language: string }) => {
      const userId = socketToUser.get(socket.id);
      const roomId = socketToRoom.get(socket.id);
      if (!userId || !roomId) return;

      const file = fileManager.createFile(roomId, name, language ?? "plaintext");
      if (!file) return;

      io.to(roomId).emit(SERVER_EVENTS.FILE_CREATED, { file });
    },
  );
}
