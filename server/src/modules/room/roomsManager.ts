import { randomUUID } from "node:crypto";
import { rooms } from "../../store/index.js";
import type { Room, EditorFile } from "../../types/globalTypes.js";

export function createRoom(ownerId: string): Room {
  const id = randomUUID();
  const fileId = randomUUID();

  const defaultFile: EditorFile = {
    id: fileId,
    name: "main.ts",
    content: "// Start coding here\n",
    language: "typescript",
    version: 0,
    updatedAt: new Date(),
  };

  const room: Room = {
    id,
    ownerId,
    users: new Set(),
    files: new Map([[fileId, defaultFile]]),
    createdAt: new Date(),
  };

  rooms.set(id, room);
  return room;
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function roomExists(roomId: string): boolean {
  return rooms.has(roomId);
}

export function addUserToRoom(roomId: string, userId: string): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;
  room.users.add(userId);
  return true;
}

export function removeUserFromRoom(roomId: string, userId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  room.users.delete(userId);
  if (room.users.size === 0) {
    rooms.delete(roomId);
  }
}

export function getRoomUsers(roomId: string): Set<string> | undefined {
  return rooms.get(roomId)?.users;
}
