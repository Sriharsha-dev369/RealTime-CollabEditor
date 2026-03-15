export interface UserData {
  userId: string;
  name: string;
  color: string;
  roomId: string;
}

const USER_COLORS = [
  "#4ade80",
  "#60a5fa",
  "#f472b6",
  "#a78bfa",
  "#34d399",
  "#fb923c",
];

const userStates = new Map<string, UserData>(); // socketId -> user data

export function assignRandomColor(): string {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
}

export function addUser(socketId: string, data: UserData): void {
  userStates.set(socketId, data);
}

export function getUser(socketId: string): UserData | undefined {
  return userStates.get(socketId);
}

export function removeUser(socketId: string): void {
  userStates.delete(socketId);
}

export function getUsersInRoom(roomId: string): UserData[] {
  return Array.from(userStates.values()).filter((u) => u.roomId === roomId);
}
