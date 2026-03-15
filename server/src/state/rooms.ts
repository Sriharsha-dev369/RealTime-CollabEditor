const roomStates = new Map<string, string>(); // roomId -> current code

export function getOrCreateRoom(roomId: string): string {
  if (!roomStates.has(roomId)) {
    roomStates.set(roomId, "// Welcome to " + roomId);
  }
  return roomStates.get(roomId)!;
}

export function getRoomCode(roomId: string): string {
  return roomStates.get(roomId) || "";
}

export function setRoomCode(roomId: string, code: string): void {
  roomStates.set(roomId, code);
}

export function deleteRoom(roomId: string): void {
  roomStates.delete(roomId);
}
