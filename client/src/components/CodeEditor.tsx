import { useState, useRef, useEffect } from "react";
import Editor, { type OnMount, type OnChange } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { socket } from "../socket";
import { useCollaboration } from "../hooks/useCollabration";
import { UsersSideBar } from "./UserSideBar";

export default function CodeEditor() {
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [user, setUser] = useState("");

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const disposablesRef = useRef<Array<{ dispose: () => void }>>([]);
  const { isRemoteChange } = useCollaboration(roomId, joined, editorRef);

  const canJoin = roomId.trim() && user.trim();

  const handleJoin = () => {
    if (canJoin) {
      socket.connect();
      setJoined(true);
    }
  };

  const handleEditorOnMount: OnMount = (editor) => {
    editorRef.current = editor;
    socket.emit("join_room", { roomId, user });
  };

  useEffect(() => {
    if (!editorRef.current) return;

    let lastEmit = 0;
    const cursorDisposable = editorRef.current.onDidChangeCursorPosition(
      (e) => {
        const now = Date.now();
        if (now - lastEmit > 50) {
          socket.emit("cursor_move", { position: e.position });
          lastEmit = now;
        }
      },
    );
    disposablesRef.current.push(cursorDisposable);

    let lastSelEmit = 0;
    const selectionDisposable = editorRef.current.onDidChangeCursorSelection(
      (e) => {
        const now = Date.now();
        if (now - lastSelEmit > 50) {
          socket.emit("selection_change", {
            selection: {
              startLineNumber: e.selection.startLineNumber,
              startColumn: e.selection.startColumn,
              endLineNumber: e.selection.endLineNumber,
              endColumn: e.selection.endColumn,
            },
          });
          lastSelEmit = now;
        }
      },
    );
    disposablesRef.current.push(selectionDisposable);

    return () => {
      disposablesRef.current.forEach((d) => d.dispose());
      disposablesRef.current = [];
    };
  }, [roomId]);

  const handleEditorChange: OnChange = (_value, event) => {
    if (isRemoteChange.current || !event.changes) return;
    socket.emit("code_delta", {
      changes: event.changes.map((c) => ({
        range: c.range,
        text: c.text,
        rangeOffset: c.rangeOffset,
        rangeLength: c.rangeLength,
      })),
    });
  };

  monaco.editor.defineTheme("collab-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: { "editor.background": "#0a0a0c" },
  });

  if (!joined) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#08080a] font-sans">
        <div className="w-[380px] p-10 rounded-2xl bg-[#111114] border border-[#1e1e26]">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-10 h-10 mx-auto mb-4 rounded-[10px] bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-lg font-bold">
              {"<>"}
            </div>
            <h1 className="text-xl font-semibold text-zinc-200 tracking-tight">
              CollabEdit
            </h1>
            <p className="text-[13px] text-zinc-600 mt-1.5">
              Real-time collaborative code editor
            </p>
          </div>

          {/* Inputs */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5 tracking-wider">
                ROOM ID
              </label>
              <input
                type="text"
                placeholder="e.g. project-alpha"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-800 bg-[#0a0a0c] text-zinc-200 text-sm outline-none transition-colors focus:border-zinc-600 placeholder:text-zinc-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5 tracking-wider">
                YOUR NAME
              </label>
              <input
                type="text"
                placeholder="e.g. Alex"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-800 bg-[#0a0a0c] text-zinc-200 text-sm outline-none transition-colors focus:border-zinc-600 placeholder:text-zinc-700"
              />
            </div>
          </div>

          {/* Button */}
          <button
            onClick={handleJoin}
            disabled={!canJoin}
            className={`w-full mt-5 py-2.5 rounded-lg border-none text-sm font-semibold transition-opacity ${
              canJoin
                ? "bg-gradient-to-br from-indigo-500 to-violet-500 text-white cursor-pointer hover:opacity-90"
                : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
            }`}
          >
            Join Room
          </button>
        </div>
      </div>
    );
  }

  /* ── Editor ── */
  return (
    <div className="flex flex-col h-screen bg-[#0a0a0c] font-sans">
      {/* Header */}
      <header className="flex justify-between items-center px-4 h-10 border-b border-[#1a1a1f] bg-[#0e0e12] shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_#4ade8066]" />
          <span className="text-[13px] font-medium text-zinc-400 tracking-tight">
            CollabEdit
          </span>
        </div>
        <span className="text-[11px] text-zinc-600 bg-[#18181b] px-2.5 py-0.5 rounded-md border border-zinc-800 font-mono">
          {roomId}
        </span>
      </header>

      {/* Editor + Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <Editor
            width="100%"
            height="100%"
            defaultLanguage="typescript"
            theme="vs-dark"
            onMount={handleEditorOnMount}
            onChange={handleEditorChange}
            options={{
              automaticLayout: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fixedOverflowWidgets: true,
              fontSize: 14,
              lineHeight: 22,
              padding: { top: 12 },
            }}
          />
        </div>
        <UsersSideBar />
      </div>
    </div>
  );
}
