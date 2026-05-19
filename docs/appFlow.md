# App Flow — RealTime-CollabEditor

Mental map of the full project flow from entry point to real-time collaboration.

---

## 1. Entry Point

```
User opens browser → React app loads → App.tsx → CodeEditor (orchestrator)
  │
  ├─ joined === false → HomePage     (join form)
  └─ joined === true  → EditorPage   (collaborative editor)
```

Socket is **not connected yet** (`autoConnect: false`). No socket activity until the user submits the form.

---

## 2. Join Flow

```
HomePage: user fills inputs → clicks "Join Room" (or presses Enter)
  │  validateRoomId + validateName run; per-field errors shown on failure
  │
  └─ onJoin(roomId, name) → CodeEditor.handleJoin()
       ├─ socket.connect()     [socket.ts — establishes WebSocket to :3000]
       ├─ setJoined(true)      [swaps HomePage → EditorPage]
       │
       └─ EditorPage mounts → handleEditorMount()
            ├─ socket.once("room:joined", ...)  ← register success handler
            ├─ socket.once("error", ...)        ← register error handler
            └─ socket.emit("room:join", { roomId, userId, name })
```

**Server receives `room:join`:**

```
roomHandler.ts
  ├─ Room exists?
  │    YES → getOrCreateUser → addSocketToUser → addUserToRoom → socket.join(roomId)
  │          emit "room:joined" to caller  ← { roomId, userId, name, color, files[], users[] }
  │          broadcast "user:joined" to room  ← { userId, name, color }
  │
  └─ NO  → emit "error" { message: "Room not found" }
```

**Client handles error (Room not found):**

```
handleJoinError()
  └─ socket.emit("room:create", { userId, name })
       │
       Server: creates room with UUID + default "main.ts" file
       └─ emit "room:created" { roomId(UUID), userId, name, color, files[] }

Client handleCreated():
  └─ setRoomId(UUID)  ← header now shows server-generated UUID
```

**Client handles success (`room:joined` / `room:created`):**

```
  ├─ currentFileId.current = files[0].id
  └─ editor.setValue(files[0].content)   ← isRemoteChange=true to suppress echo
```

---

## 3. Collaborative State Setup (runs parallel to join)

**`useCollaboration`** (inside EditorPage, active immediately):

```
listens for "room:joined"
  └─ populates userMap: Map<userId → { name, color }>
     injects CSS styles per user (for cursor coloring)
```

**`useUsersList`** (inside UsersSideBar, always active):

```
listens for "room:joined"
  └─ sets users[] state → feeds UsersSideBar
```

---

## 4. Real-Time Editing

```
User types in Monaco editor
  └─ onChange fires → handleEditorChange()
       │   isRemoteChange.current? → skip (it's a remote edit, not ours)
       └─ socket.emit("file:update", { fileId, changes: [{ range, text, rangeOffset, rangeLength }] })

Server (fileHandler.ts):
  ├─ applyChanges() → updates file.content in memory (rooms Map)
  └─ socket.to(roomId).emit("file:updated", { fileId, changes, userId })
                              ↑ excludes sender

Other clients (useCollaboration):
  └─ handleFileUpdated()
       ├─ isRemoteChange.current = true
       ├─ editor.executeEdits("remote", changes)   ← Monaco applies the delta
       └─ isRemoteChange.current = false
```

---

## 5. Cursor Presence

```
User moves cursor
  └─ onDidChangeCursorPosition (throttled 50ms)
       └─ socket.emit("cursor:update", { fileId, line, col })

Server (presenceHandler.ts):
  ├─ setUserCursor(userId, { line, col })
  ├─ setUserActiveFile(userId, fileId)
  └─ socket.to(roomId).emit("cursor:updated", { userId, fileId, line, col })

Other clients (useCollaboration → useRemoteCursors):
  └─ handleCursorUpdated()
       ├─ look up userMap → get { name, color }
       └─ applyCursor({ userId, line, col, color, name })
            └─ Monaco decoration: 2px colored bar + name label above cursor
```

### useRemoteCursors (internal to useCollaboration)

```
Owns all Monaco decoration state for remote cursors and selections:
  ├─ cursorCollections: Map<userId, IEditorDecorationsCollection>
  ├─ selectionCollections: Map<userId, IEditorDecorationsCollection>
  │
  ├─ injectUserStyle(userId, color, name)
  │    └─ injects <style id="monaco-cursor-{safeId}"> into <head>
  │         with CSS classes: .cursor-{id}, .label-{id}, .selection-{id}
  │         safeId strips non-alphanumeric chars + prefixes "u" (UUID-safe)
  │
  ├─ applyCursor({ userId, line, col, color, name })
  │    └─ sets a 2px bar decoration + beforeContent label on that line/col
  │
  ├─ applySelection({ userId, selection, color, name })
  │    └─ sets a translucent highlight decoration over the selected range
  │         (no-op if selection is collapsed)
  │
  └─ removeCursor(userId)
       ├─ clears + deletes both decoration collections for the user
       └─ removes the injected <style> tag

Cleanup on unmount: all collections cleared, all style tags removed.
```

---

## 6. User Joins / Leaves

```
New user joins:
  Joiner ← "room:joined" (full state)
  Others ← "user:joined" { userId, name, color }
    ├─ useCollaboration: add to userMap + inject CSS style
    │   + re-emit our cursor:update so new user sees us
    └─ useUsersList: add to users[] → sidebar updates

User disconnects:
  disconnectHandler → leaveRoom()
    ├─ checks if user has other sockets still in room (multi-device support)
    └─ if truly gone: broadcast "user:left" { userId }
         ├─ useCollaboration: delete from userMap + removeCursor (clears Monaco decorations)
         └─ useUsersList: filter from users[] → sidebar updates
```

### useUsersList (inside UsersSideBar)

```
Manages the users[] state array that drives the sidebar list:
  ├─ "room:joined" → replaces users[] with server's full user list (initial + reconnect)
  ├─ "user:joined" → appends new user (deduped by userId)
  └─ "user:left"   → filters user out + clears any pending idle timer

Returns: { users: UserData[] }  (consumed by UsersSideBar)
```

### UsersSideBar

```
Collapsible right panel (w-60 ↔ w-0, toggle button always visible):
  ├─ Header: "Users" label + online count + avatar stack (up to 3, +N overflow)
  ├─ Search input: filters by name (local, no socket)
  └─ User list: Avatar (colored initials ring) + name + StatusDot
       StatusDot colors: green=editing · blue=viewing · grey=idle
       (status field on UserData — currently always "viewing", not driven by events)

Cleanup: idle timers cleared on unmount.
```

### FileSideBar

```
Collapsible left panel (w-52 ↔ w-0, toggle button always visible):
  ├─ Header: "Files" label + file count + "+" button
  ├─ File list: icon badge (ts/js/py/…) + filename, active file highlighted
  │    click → onFileSelect(fileId)
  │               └─ EditorPage.handleFileSelect: currentFileId.current = fileId
  │                    + editor.setValue(file.content) with isRemoteChangeRef guard
  └─ Inline new-file input (shown on "+" click):
       Enter → onFileCreate(name) → socket.emit("file:create", { name, language })
       Escape / blur → cancel
```

---

## 7. Component Ownership

```
App.tsx
  └─ CodeEditor.tsx          (orchestrator)
       │  state: joined, roomId, name, userId, error, isConnecting
       │  owns:  socket.connect(), page switching
       │
       ├─ pages/HomePage.tsx          (pre-join)
       │    state: roomId, name inputs, fieldErrors
       │    logic: validateRoomId, validateName, FormField
       │    emits: onJoin(roomId, name) → CodeEditor
       │
       └─ pages/EditorPage.tsx        (post-join)
            state: connected
            refs:  editorRef, currentFileId, disposablesRef
            hooks: useCollaboration (socket events, userMap, reconnect)
            ui:    header, Monaco editor, UsersSideBar
```

---

## 10. In-Memory State (Server)

```
store/index.ts
  ├─ rooms: Map<roomId, Room>
  │    └─ Room: { id, ownerId, users: Set<userId>, files: Map<fileId,EditorFile>, roles?(Map), fileOrder?(string[]), ... }
  ├─ users: Map<userId, UserState>
  │    └─ UserState: { userId, name, color, socketIds: Set<string>, activeFileId, cursor }
  ├─ socketToUser: Map<socketId, userId>   ← reverse lookup
  └─ socketToRoom: Map<socketId, roomId>   ← reverse lookup
```

All state is **in-memory only** — no database, no persistence. Server restart = everything gone.

---

## 9. Reconnect & Resilience (EditorPage)

### Connection State

The header dot reflects live connection status:

- Green → connected
- Yellow + "Reconnecting…" → socket dropped, auto-reconnecting

`socket.ts` has `reconnection: true` with exponential backoff (1s → 5s, max 5 attempts). Socket.IO handles the transport layer automatically.

### Auto Rejoin

```
Network drops → socket disconnects
  └─ isConnectedRef.current = false   (useCollaboration handleDisconnect)
  └─ offlineQueue accumulates changes (EditorPage handleEditorChange)

Socket auto-reconnects → "connect" event fires
  └─ handleConnect() in useCollaboration
       ├─ hasJoined.current === true?  ← only true after a successful room:join
       └─ YES → socket.emit("room:join", { roomId, userId, name })
```

The backend's `getOrCreateUser` handles the same userId reconnecting gracefully — restores the user's color and name without creating a duplicate.

### Full State Resync

```
"room:joined" fires after reconnect (isReconnect = true):
  ├─ Rebuild userMap from fresh server users[]
  ├─ editor.setValue(files[0].content)  ← server state wins
  ├─ currentFileId.current = files[0].id
  └─ socket.emit("cursor:update", current position)  ← restore cursor for others
```

### Offline Queue & Flush

```
While disconnected:
  └─ handleEditorChange → push to offlineQueue[] instead of emitting

On reconnect (room:joined):
  └─ offlineQueue.current = []  ← discarded; server content is authoritative
```

The user can keep typing while offline. On reconnect, the editor resets to server state (the last version other users have). Offline changes are discarded — this is the safe choice for a collaborative editor where conflicts can't be resolved without OT/CRDT.

---

## 8b. File Management

```
FileSideBar (left panel):
  ├─ Displays file list from room state (files[] populated on room:joined / room:created)
  ├─ Highlights activeFileId
  ├─ Click file → handleFileSelect()
  │    ├─ currentFileId.current = fileId
  │    └─ editor.setValue(file.content)   ← isRemoteChange=true to suppress echo
  └─ "+" button → inline input → Enter to commit
       └─ socket.emit("file:create", { name, language: "typescript" })
            │
            Server (fileHandler.ts):
              ├─ createFile() → adds to room.files Map
              └─ io.to(roomId).emit("file:created", { file })  ← all users including creator

All clients (EditorPage useEffect):
  └─ handleFileCreated → setFiles(prev => [...prev, file])
```

File list is also refreshed on reconnect via the `room:joined` resync (same effect listener).

---

## 8c. Leave Room

```
User clicks "Leave" in header → handleLeave()
  ├─ socket.emit("room:leave")
  │    └─ Server (roomHandler.ts) → leaveRoom()
  │         ├─ socket.leave(roomId)
  │         ├─ removes socket from user's socketIds
  │         └─ if no sockets left in room: broadcast "user:left" { userId }
  ├─ socket.disconnect()
  └─ setJoined(false)  ← back to HomePage
```

---

## 11. What's NOT wired up yet

| Feature                               | Status                                          |
| ------------------------------------- | ----------------------------------------------- |
| Roles (`owner` / `editor` / `viewer`) | Stored in Room, never enforced                  |
| User status (editing/viewing/idle)    | UI exists in sidebar, not driven by real events |
| Persistence / DB                      | Not implemented                                 |
| Auth / security                       | No auth, userId is client-generated UUID        |
| Language selection for new files      | Always creates as "typescript"                  |
