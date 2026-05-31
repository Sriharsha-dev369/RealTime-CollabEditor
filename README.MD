# RealTime-CollabEditor

A real-time collaborative code editor built with React, Monaco Editor, Node.js, and Socket.IO. Multiple users can join a shared room, edit files simultaneously, and see each other's cursors and presence live.

---

## Features

- **Real-time collaborative editing** — simultaneous multi-user editing with version-based consistency
- **Live cursor presence** — colored per-user cursors with name labels and selection range highlights
- **Multi-file support** — create and switch between files within a room
- **Room system** — create or join rooms via invite link / room ID; server is the source of truth for room IDs
- **User sidebar** — live list of active users with online count and avatar stack
- **Auto-reconnect** — socket drops auto-rejoin the room and resync editor state from the server
- **Offline queue** — changes typed while disconnected are held and server state wins on reconnect

---

## Tech Stack

| Layer    | Technology                                      |
| -------- | ----------------------------------------------- |
| Frontend | React 19 + TypeScript, Vite, Tailwind CSS v4    |
| Editor   | Monaco Editor (`@monaco-editor/react`)          |
| Backend  | Node.js + Express 5, TypeScript, tsx / nodemon  |
| Realtime | Socket.IO v4 (client + server)                  |

---

## Project Structure

```
RealTime-CollabEditor/
├── client/                  # React frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/      # Reusable UI components
│   │   ├── hooks/           # useCollaboration, useUsersList, useRemoteCursors
│   │   ├── pages/           # HomePage, EditorPage
│   │   ├── socket/          # Socket event handlers
│   │   ├── socket.ts        # Socket.IO client instance
│   │   └── types/
│   └── package.json
│
├── server/                  # Node.js backend
│   ├── src/
│   │   ├── index.ts         # Entry point
│   │   ├── config.ts
│   │   ├── modules/         # room/, user/, file/ core logic
│   │   ├── socket/          # handlers/, events.ts
│   │   ├── store/           # In-memory state (rooms, users, socket maps)
│   │   ├── utils/           # Real-time edit helpers
│   │   └── types/
│   └── package.json
│
└── docs/
    ├── appFlow.md           # Full app flow documentation
    ├── socket-flow.md       # Socket event reference
    └── state.md             # Server state shape
```

---

## Getting Started

### Prerequisites

- Node.js >= 18

### Install dependencies

```bash
# Install server deps
cd server && npm install

# Install client deps
cd ../client && npm install
```

### Run in development

```bash
# Terminal 1 — start the backend (port 3000)
cd server && npm run dev

# Terminal 2 — start the frontend (port 5173)
cd client && npm run dev
```

Open `http://localhost:5173` in your browser.

### Build for production

```bash
cd server && npm run build    # compiles TypeScript → dist/
cd client && npm run build    # Vite build → dist/
```

Start the production server:

```bash
cd server && npm start
```

---

## How It Works

### Join / Create a Room

1. Open the app — you land on the **Home Page**.
2. Enter a room ID and a display name, then click **Join Room**.
3. If the room doesn't exist yet, the server creates one automatically and assigns a UUID room ID.
4. The room ID is displayed in the header — share it with others to collaborate.

### Editing

- All keystrokes are streamed to the server as Monaco delta changes and broadcast to every other user in the room.
- The sender's own changes are suppressed from the echo loop (`isRemoteChange` ref guard).
- Remote edits are applied via `editor.executeEdits()` so undo history is preserved.

### Cursor Presence

- Cursor position is emitted throttled at ~50 ms.
- Each user gets a unique color assigned by the server.
- Remote cursors render as a colored 2 px bar with a name label injected via CSS into the Monaco editor.
- Selections are highlighted with a translucent overlay.

### Reconnect & Resilience

- `socket.ts` is configured with `reconnection: true` and exponential backoff (1 s → 5 s, max 5 attempts).
- On reconnect, the client re-emits `room:join` and the server restores the user's name and color without creating a duplicate.
- The editor resets to server state on resync — offline edits are discarded, as the server is authoritative.

### In-Memory State (Server)

```
store/index.ts
├── rooms:        Map<roomId, Room>       — files, users, roles
├── users:        Map<userId, UserState>  — name, color, socketIds, cursor
├── socketToUser: Map<socketId, userId>   — reverse lookup
└── socketToRoom: Map<socketId, roomId>   — reverse lookup
```

> All state is in-memory — no database. A server restart clears everything.

---

## Roadmap / Planned Features

| Feature                               | Status                              |
| ------------------------------------- | ----------------------------------- |
| OT / CRDT conflict resolution         | Planned (current: version-based)    |
| Roles (owner / editor / viewer)       | Stored, not yet enforced            |
| User status (editing / viewing / idle)| UI exists, not yet event-driven     |
| Persistence / database                | Not implemented                     |
| Auth / access control                 | Not implemented (UUID-based userId) |
| Language selection for new files      | Always creates as TypeScript        |
| Diff-based partial updates            | Planned                             |
| Optimistic UI + rollback              | Planned                             |

---

## Project Scope Reference

### Core Collaboration Engine (MUST-HAVE)

**Real-time Editing**
- Multi-user simultaneous editing
- Version-based consistency (current model)
- Future upgrade → OT / CRDT

**Multi-file Project System**
- Nested folders (tree structure)
- File metadata (language, size, lastModified)
- Open tabs + tab persistence

**Presence System**
- Active users list
- File-level presence (who is viewing / editing which file)
- Typing indicators

**Cursor System**
- Live cursor position
- Selection ranges (not just cursor)
- Colored cursors per user
- Smooth interpolation (avoid jitter)

### Real-Time Sync Quality (CRITICAL)

**Optimization**
- Debounce (50–100 ms)
- Batching updates
- Partial updates (diff-based, planned)

**Conflict Handling**
- Current: version reject + reapply
- Future: OT / CRDT

**Network Handling**
- Latency compensation
- Optimistic UI
- Rollback system

### Room System

**Room Lifecycle**
- Create / join / leave
- Auto cleanup when empty
- Reconnect recovery

**Sharing**
- Invite link
- Room ID system
- Optional access control (future)

### Reconnect & Resilience

- Auto rejoin after disconnect
- Full state resync on reconnect
- Cursor restore
- Retry failed ops
- Temporary offline queue (discarded on reconnect in favor of server state)

---

## Contributing

1. Fork the repo and create a feature branch.
2. Run `npm run dev` in both `server/` and `client/`.
3. Open a PR against `main` with a clear description of the change.

---

## License

ISC
