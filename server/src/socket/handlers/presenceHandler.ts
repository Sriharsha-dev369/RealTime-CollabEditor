import type { Server, Socket } from "socket.io";
import { CLIENT_EVENTS, SERVER_EVENTS } from "../events.js";
import { socketToUser, socketToRoom } from "../../store/index.js";
import * as userManager from "../../modules/user/usersManager.js";

export function registerPresenceHandler(_io: Server, socket: Socket): void {
  socket.on(
    CLIENT_EVENTS.CURSOR_UPDATE,
    ({
      fileId,
      line,
      col,
    }: {
      fileId: string;
      line: number;
      col: number;
    }) => {
      const userId = socketToUser.get(socket.id);
      const roomId = socketToRoom.get(socket.id);
      if (!userId || !roomId) return;

      userManager.setUserCursor(userId, { line, col });
      userManager.setUserActiveFile(userId, fileId);

      socket.to(roomId).emit(SERVER_EVENTS.CURSOR_UPDATED, {
        userId,
        fileId,
        line,
        col,
      });
    },
  );
}
