import { useState, useRef } from "react";
import Editor, { type OnMount, type OnChange } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { socket } from "../socket";
import { useCollaboration } from "../hooks/useCollabration";

export default function CodeEditor() {
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  
  const { isRemoteChange } = useCollaboration(roomId, joined, editorRef);

  const handleJoin = () => {
    if (roomId.trim()) {
      socket.connect();
      setJoined(true);
    }
  };

  const handleEditorOnMount: OnMount = (editor) => {
    editorRef.current = editor;

    let lastEmit = 0;
    editor.onDidChangeCursorPosition((e) => {
      const now = Date.now();
      if (now - lastEmit > 50) {
        socket.emit("cursor_move", { roomId, position: e.position });
        lastEmit = now;
      }
    });

    socket.emit("join_room", roomId);
  };

  const handleEditorChange: OnChange = (_value, event) => {
    if (isRemoteChange.current || !event.changes) return;

    socket.emit("code_delta", {
      roomId,
      changes: event.changes.map((c) => ({
        range: c.range,
        text: c.text,
        rangeOffset: c.rangeOffset,
        rangeLength: c.rangeLength,
      })),
    });
  };

  if (!joined) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#1e1e1e] text-white gap-5">
        <h1>Collaborative Editor</h1>
        <input
          type="text"
          placeholder="Enter Room ID..."
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="p-2.5 rounded-[5px] border-none w-62.5 text-black outline-none"
        />
        <button
          onClick={handleJoin}
          className="px-5 py-2.5 cursor-pointer bg-[#007acc] text-white border-none rounded-[5px] hover:bg-[#005f9e] transition-colors"
        >
          Join Room
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e]">
      <header className="p-2.5 bg-[#333] text-white text-[14px] flex justify-between items-center">
        <span>Monaco Collaborative Session</span>
        <span className="text-xs opacity-50">Room: {roomId}</span>
      </header>
      <Editor
        className="flex-1 overflow-hidden"
        defaultLanguage="typescript"
        theme="vs-dark"
        onMount={handleEditorOnMount}
        onChange={handleEditorChange}
        options={{
          automaticLayout: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fixedOverflowWidgets: true,
        }}
      />
    </div>
  );
}