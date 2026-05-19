Project Scope :

1. Core Collaboration Engine (MUST-HAVE)

Real-time Editing =>
multi-user simultaneous editing
version-based consistency (your current model)
future upgrade → OT / CRDT

Multi-file Project System =>
nested folders (tree structure)
file metadata (language, size, lastModified)
open tabs + tab persistence

Presence System =>
active users list
file-level presence (who is viewing , editing which file)
typing indicators

Cursor System =>
live cursor position
selection ranges (not just cursor)
colored cursors per user
smooth interpolation (avoid jitter)

2. Real-Time Sync Quality (CRITICAL)

Optimization =>
debounce (50–100ms)
batching updates
partial updates (diff-based later)

Conflict Handling =>
current: version reject + reapply
future: OT / CRDT

Network Handling =>  
latency compensation
optimistic UI
rollback system

3. Room System (Collaboration Layer)

Room Lifecycle =>
create / join / leave
auto cleanup when empty
reconnect recovery

Sharing =>
invite link
room ID system
optional access control (future)

4. Reconnect & Resilience

Reconnect Handling =>
auto rejoin
full state resync
cursor restore

Failure Handling =>
retry failed ops
temporary offline queue

5. Reconnect & Resilience

->>create UserId in clinet and store in cookies.

Reconnect Handling =>
auto rejoin
full state resync
cursor restore

Failure Handling =>
retry failed ops
temporary offline queue

Development Arch :

server/
│
├── src/
│ ├── app.js
│ ├── config.js
│
│ ├── modules/(Core logic)
│ │ ├── room/
│ │ ├── user/
│ │ └── file/
│
│ ├── socket/
│ │ ├── handlers/
│ │ └── events.js
│
│ ├── services/()
│ ├── store/(Persistence)
│ ├── utils/(Real time Edits logic)
│ └── types/  
│
└── package.json
