# Data Flow — In-Memory State

All state lives in `server/src/store/index.ts`. No database. Server restart clears everything.

---

## Store Maps

```
rooms: Map<roomId, Room>
users: Map<userId, UserState>
socketToUser: Map<socketId, userId>   ← reverse lookup: which user owns this socket
socketToRoom: Map<socketId, roomId>   ← reverse lookup: which room is this socket in
```

---

## Shape

```
Room {
  id: string                          ← server-generated UUID
  ownerId: string                     ← userId of creator
  users: Map<userId, UserState>       ← all users currently in room
  roles: Map<userId, "owner" | "editor" | "viewer">
  files: Map<fileId, EditorFile>
  fileOrder: string[]                 ← ordered list of fileIds
  activeFileId?: string
  createdAt: Date
  lastActiveAt: Date
}

UserState {
  userId: string                      ← client-generated UUID (not verified)
  name: string
  color: string                       ← assigned from palette on first connect
  socketIds: Set<string>              ← supports same user on multiple tabs/devices
  activeFileId?: string
  cursor?: { line: number, col: number }
}

EditorFile {
  id: string                          ← UUID
  name: string                        ← e.g. "main.ts"
  content: string                     ← full file text, kept up to date by applyChanges()
  language: string                    ← e.g. "typescript"
  version: number                     ← increments on each update
  updatedAt: Date
}
```

---

## How State Changes

| Event received | State mutation |
|---|---|
| `room:create` | new Room added to `rooms`, new UserState in `users` |
| `room:join` | UserState added/updated in `users`, userId added to `room.users` |
| `file:update` | `file.content` patched via `applyChanges()`, `file.version++` |
| `file:create` | new EditorFile added to `room.files` and `room.fileOrder` |
| `cursor:update` | `user.cursor` and `user.activeFileId` updated |
| disconnect | socket removed from `user.socketIds`; if empty → user removed from room; if room empty → room deleted |

---

## Multi-Device / Multi-Tab

A single `userId` can have multiple `socketIds` (Set). A user is only considered "left" when all their sockets disconnect from the room. This is checked in `leaveRoom()` via `socketToRoom` before broadcasting `user:left`.
