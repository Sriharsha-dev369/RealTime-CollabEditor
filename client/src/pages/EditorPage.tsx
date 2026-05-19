import { useState, useRef, useEffect } from "react";
import Editor, { type OnMount, type OnChange } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { socket } from "../socket";
import { CLIENT_EVENTS, SERVER_EVENTS } from "../socket/events";
import { useCollaboration } from "../hooks/useCollabration";
import { UsersSideBar } from "../components/UserSideBar";
import { FileSideBar } from "../components/FileSideBar";
import type { RoomJoinedPayload, RoomCreatedPayload, EditorFile } from "../types/collabration";

monaco.editor.defineTheme("collab-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: { "editor.background": "#0a0a0c" },
});

interface EditorPageProps {
  roomId: string;
  userId: string;
  name: string;
  onRoomIdChange: (id: string) => void;
  setError: (msg: string | null) => void;
  setIsConnecting: (v: boolean) => void;
  setJoined: (v: boolean) => void;
}

export default function EditorPage({
  roomId,
  userId,
  name,
  onRoomIdChange,
  setError,
  setIsConnecting,
  setJoined,
}: EditorPageProps) {
  const [connected, setConnected] = useState(true);
  const [files, setFiles] = useState<EditorFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const disposablesRef = useRef<Array<{ dispose: () => void }>>([]);
  const currentFileId = useRef<string | null>(null);

  const { isRemoteChangeRef, isConnectedRef, offlineQueue } = useCollaboration(
    editorRef,
    currentFileId,
    userId,
    roomId,
    name,
    setError,
  );

  // Drive the header connection dot
  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  // Clean up Monaco disposables on unmount
  useEffect(() => {
    return () => {
      disposablesRef.current.forEach((d) => d.dispose());
      disposablesRef.current = [];
    };
  }, []);

  // Sync files list on reconnect and when a new file is created by anyone
  useEffect(() => {
    const handleRoomJoined = (data: RoomJoinedPayload) => {
      setFiles(data.files);
      setActiveFileId(data.files[0]?.id ?? null);
    };
    const handleFileCreated = (data: { file: EditorFile }) => {
      setFiles((prev) => [...prev, data.file]);
    };
    socket.on(SERVER_EVENTS.ROOM_JOINED, handleRoomJoined);
    socket.on(SERVER_EVENTS.FILE_CREATED, handleFileCreated);
    return () => {
      socket.off(SERVER_EVENTS.ROOM_JOINED, handleRoomJoined);
      socket.off(SERVER_EVENTS.FILE_CREATED, handleFileCreated);
    };
  }, []);

  const handleFileSelect = (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (!file || !editorRef.current) return;
    currentFileId.current = fileId;
    setActiveFileId(fileId);
    isRemoteChangeRef.current = true;
    editorRef.current.setValue(file.content);
    isRemoteChangeRef.current = false;
  };

  const handleFileCreate = (name: string) => {
    socket.emit(CLIENT_EVENTS.FILE_CREATE, { name, language: "typescript" });
  };

  const handleLeave = () => {
    socket.emit(CLIENT_EVENTS.ROOM_LEAVE);
    socket.disconnect();
    setJoined(false);
  };

  const handleEditorMount: OnMount = (editor) => {
    try {
      editorRef.current = editor;

      const handleJoined = (data: RoomJoinedPayload) => {
        setFiles(data.files);
        currentFileId.current = data.files[0]?.id ?? null;
        setActiveFileId(data.files[0]?.id ?? null);
        const file = data.files[0];
        if (file) {
          isRemoteChangeRef.current = true;
          editor.setValue(file.content);
          isRemoteChangeRef.current = false;
        }
        setIsConnecting(false);
        socket.off(SERVER_EVENTS.ERROR, handleJoinError);
      };

      const handleCreated = (data: RoomCreatedPayload) => {
        onRoomIdChange(data.roomId);
        setFiles(data.files);
        currentFileId.current = data.files[0]?.id ?? null;
        setActiveFileId(data.files[0]?.id ?? null);
        const file = data.files[0];
        if (file) {
          isRemoteChangeRef.current = true;
          editor.setValue(file.content);
          isRemoteChangeRef.current = false;
        }
        setIsConnecting(false);
      };

      const handleJoinError = (err: { message: string }) => {
        socket.off(SERVER_EVENTS.ROOM_JOINED, handleJoined);
        if (err.message === "Room not found") {
          socket.once(SERVER_EVENTS.ROOM_CREATED, handleCreated);
          socket.emit(CLIENT_EVENTS.ROOM_CREATE, { userId, name });
        } else {
          setError(err.message);
          setJoined(false);
          setIsConnecting(false);
        }
      };

      socket.once(SERVER_EVENTS.ROOM_JOINED, handleJoined);
      socket.once(SERVER_EVENTS.ERROR, handleJoinError);
      socket.emit(CLIENT_EVENTS.ROOM_JOIN, { roomId, userId, name });

      let lastEmit = 0;
      const cursorDisposable = editor.onDidChangeCursorPosition((e) => {
        try {
          const now = Date.now();
          if (now - lastEmit > 50) {
            socket.emit(CLIENT_EVENTS.CURSOR_UPDATE, {
              fileId: currentFileId.current ?? "",
              line: e.position.lineNumber,
              col: e.position.column,
            });
            lastEmit = now;
          }
        } catch (err) {
          console.error("Error emitting cursor:update:", err);
        }
      });
      disposablesRef.current.push(cursorDisposable);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to join room";
      setError(message);
      setJoined(false);
      setIsConnecting(false);
      console.error("Mount error:", err);
    }
  };

  const handleEditorChange: OnChange = (_value, event) => {
    try {
      if (
        isRemoteChangeRef.current ||
        !event.changes ||
        event.changes.length === 0 ||
        !currentFileId.current
      )
        return;

      const changes = event.changes.map((c) => ({
        range: c.range,
        text: c.text,
        rangeOffset: c.rangeOffset,
        rangeLength: c.rangeLength,
      }));

      if (!isConnectedRef.current) {
        offlineQueue.current.push({ fileId: currentFileId.current, changes });
        return;
      }

      socket.emit(CLIENT_EVENTS.FILE_UPDATE, {
        fileId: currentFileId.current,
        changes,
      });
    } catch (err) {
      console.error("Error emitting file:update:", err);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0c] font-sans">
      {/* Header */}
      <header className="flex justify-between items-center px-4 h-10 border-b border-[#1a1a1f] bg-[#0e0e12] shrink-0">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              connected
                ? "bg-green-400 shadow-[0_0_8px_#4ade8066]"
                : "bg-yellow-400 shadow-[0_0_8px_#facc1566]"
            }`}
          />
          <span className="text-[13px] font-medium text-zinc-400 tracking-tight">
            {connected ? "CollabEdit" : "Reconnecting…"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-zinc-600 bg-[#18181b] px-2.5 py-0.5 rounded-md border border-zinc-800 font-mono">
            {roomId}
          </span>
          <button
            onClick={handleLeave}
            className="text-[11px] text-zinc-500 hover:text-red-400 transition-colors px-2 py-0.5 rounded border border-transparent hover:border-red-500/30"
          >
            Leave
          </button>
        </div>
      </header>

      {/* File Sidebar + Editor + Users Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <FileSideBar
          files={files}
          activeFileId={activeFileId}
          onFileSelect={handleFileSelect}
          onFileCreate={handleFileCreate}
        />
        <div className="flex-1 overflow-hidden">
          <Editor
            width="100%"
            height="100%"
            defaultLanguage="typescript"
            theme="vs-dark"
            onMount={handleEditorMount}
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
