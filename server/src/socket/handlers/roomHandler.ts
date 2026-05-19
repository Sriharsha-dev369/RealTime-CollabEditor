import type { Server, Socket } from "socket.io";
import { CLIENT_EVENTS, SERVER_EVENTS } from "../events.js";
import { socketToUser, socketToRoom } from "../../store/index.js";
import * as roomManager from "../../modules/room/roomsManager.js";
import * as userManager from "../../modules/user/usersManager.js";
import type { UserState } from "../../types/globalTypes.js";

function serializeRoomUsers(roomId: string): object[] {
  const userIds = roomManager.getRoomUsers(roomId) ?? new Set<string>();
  return Array.from(userIds)
    .map((uid) => userManager.getUser(uid))
    .filter((u): u is UserState => u !== undefined)
    .map(({ userId, name, color, activeFileId, cursor }) => ({
      userId,
      name,
      color,
      activeFileId,
      cursor,
    }));
}

export function registerRoomHandler(io: Server, socket: Socket): void {
  socket.on(
    CLIENT_EVENTS.ROOM_CREATE,
    ({ userId, name }: { userId: string; name: string }) => {
      const user = userManager.getOrCreateUser(userId, name);
      userManager.addSocketToUser(userId, socket.id);
      socketToUser.set(socket.id, userId);

      const room = roomManager.createRoom(userId);
      roomManager.addUserToRoom(room.id, userId);
      socketToRoom.set(socket.id, room.id);

      socket.join(room.id);

      socket.emit(SERVER_EVENTS.ROOM_CREATED, {
        roomId: room.id,
        userId: user.userId,
        name: user.name,
        color: user.color,
        files: Array.from(room.files.values()),
      });
    },
  );

  socket.on(
    CLIENT_EVENTS.ROOM_JOIN,
    ({
      roomId,
      userId,
      name,
    }: {
      roomId: string;
      userId: string;
      name: string;
    }) => {
      if (!roomManager.roomExists(roomId)) {
        socket.emit(SERVER_EVENTS.ERROR, { message: "Room not found" });
        return;
      }

      // Handles both first-join and reconnect recovery (same userId restores state)
      const user = userManager.getOrCreateUser(userId, name);
      userManager.addSocketToUser(userId, socket.id);
      socketToUser.set(socket.id, userId);
      socketToRoom.set(socket.id, roomId);

      roomManager.addUserToRoom(roomId, userId);
      socket.join(roomId);

      const room = roomManager.getRoom(roomId)!;

      socket.emit(SERVER_EVENTS.ROOM_JOINED, {
        roomId,
        userId: user.userId,
        name: user.name,
        color: user.color,
        activeFileId: user.activeFileId,
        files: Array.from(room.files.values()),
        users: serializeRoomUsers(roomId),
      });

      socket.to(roomId).emit(SERVER_EVENTS.USER_JOINED, {
        userId: user.userId,
        name: user.name,
        color: user.color,
      });
    },
  );

  socket.on(CLIENT_EVENTS.ROOM_LEAVE, () => {
    const userId = socketToUser.get(socket.id);
    const roomId = socketToRoom.get(socket.id);
    if (!userId || !roomId) return;
    leaveRoom(io, socket, userId, roomId);
  });
}

export function leaveRoom(
  io: Server,
  socket: Socket,
  userId: string,
  roomId: string,
): void {
  socket.leave(roomId);
  socketToUser.delete(socket.id);
  socketToRoom.delete(socket.id);

  userManager.removeSocketFromUser(userId, socket.id);

  // Only remove from room if the user has no other sockets still in it
  const remainingSockets = userManager.getUser(userId)?.socketIds ?? new Set();
  const stillInRoom = Array.from(remainingSockets).some(
    (sid) => socketToRoom.get(sid) === roomId,
  );

  if (!stillInRoom) {
    roomManager.removeUserFromRoom(roomId, userId);
    io.to(roomId).emit(SERVER_EVENTS.USER_LEFT, { userId });
  }
}
