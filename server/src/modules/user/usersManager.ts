import { users } from "../../store/index.js";
import type { UserState } from "../../types/globalTypes.js";

const USER_COLORS = [
  "#4ade80",
  "#60a5fa",
  "#f472b6",
  "#a78bfa",
  "#34d399",
  "#fb923c",
];

export function assignRandomColor(): string {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
}

export function getOrCreateUser(userId: string, name: string): UserState {
  if (!users.has(userId)) {
    users.set(userId, {
      userId,
      name,
      color: assignRandomColor(),
      socketIds: new Set(),
    });
  }
  return users.get(userId)!;
}

export function getUser(userId: string): UserState | undefined {
  return users.get(userId);
}

export function addSocketToUser(userId: string, socketId: string): void {
  users.get(userId)?.socketIds.add(socketId);
}

// Returns true if the user has no remaining sockets (fully disconnected)
export function removeSocketFromUser(userId: string, socketId: string): boolean {
  const user = users.get(userId);
  if (!user) return true;
  user.socketIds.delete(socketId);
  if (user.socketIds.size === 0) {
    users.delete(userId);
    return true;
  }
  return false;
}

export function setUserCursor(
  userId: string,
  cursor: { line: number; col: number },
): void {
  const user = users.get(userId);
  if (user) user.cursor = cursor;
}

export function setUserActiveFile(userId: string, fileId: string): void {
  const user = users.get(userId);
  if (user) user.activeFileId = fileId;
}
