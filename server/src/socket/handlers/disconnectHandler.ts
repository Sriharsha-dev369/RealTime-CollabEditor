import type { Server, Socket } from "socket.io";
import { socketToUser, socketToRoom } from "../../store/index.js";
import { leaveRoom } from "./roomHandler.js";

export function registerDisconnectHandler(io: Server, socket: Socket): void {
  socket.on("disconnect", () => {
    const userId = socketToUser.get(socket.id);
    const roomId = socketToRoom.get(socket.id);
    if (!userId || !roomId) return;
    leaveRoom(io, socket, userId, roomId);
  });
}
