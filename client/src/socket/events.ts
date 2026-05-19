// Client → Server
export const CLIENT_EVENTS = {
  ROOM_CREATE: "room:create",
  ROOM_JOIN: "room:join",
  ROOM_LEAVE: "room:leave",
  FILE_UPDATE: "file:update",
  FILE_CREATE: "file:create",
  CURSOR_UPDATE: "cursor:update",
} as const;

// Server → Client
export const SERVER_EVENTS = {
  ROOM_CREATED: "room:created",
  ROOM_JOINED: "room:joined",
  ROOM_LEFT: "room:left",
  USER_JOINED: "user:joined",
  USER_LEFT: "user:left",
  FILE_UPDATED: "file:updated",
  FILE_CREATED: "file:created",
  CURSOR_UPDATED: "cursor:updated",
  ERROR: "error",
} as const;
