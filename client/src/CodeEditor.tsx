import { useEffect, useRef, useState, useCallback } from "react";
import Editor, { type OnMount, type OnChange } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { socket } from "./socket";

interface MonacoChange {
  range: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
  text: string;
  rangeOffset: number;
  rangeLength: number;
}

export default function CodeEditor() {
  const [roomId, setRoomId] = useState<string>("");
  const [joined, setJoined] = useState(false);

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const isRemoteChange = useRef(false);

  // 1. Listeners setup (Runs once on mount)
  useEffect(() => {
    const handleInitCode = (fullCode: string) => {
      if (editorRef.current) {
        isRemoteChange.current = true;
        editorRef.current.setValue(fullCode);
        isRemoteChange.current = false;
      }
    };

    const handleReceiveDelta = (data: { changes: MonacoChange[] }) => {
      const editorInstance = editorRef.current;
      if (!editorInstance) return;

      isRemoteChange.current = true;
      editorInstance.executeEdits(
        "remote-source",
        data.changes.map((change) => ({
          range: change.range,
          text: change.text,
          forceMoveMarkers: true,
        })),
      );
      isRemoteChange.current = false;
    };

    socket.on("init_code", handleInitCode);
    socket.on("receive_delta", handleReceiveDelta);

    return () => {
      socket.off("init_code", handleInitCode);
      socket.off("receive_delta", handleReceiveDelta);
      socket.disconnect();
    };
  }, []);

  // 2. Triggered by Button click
  const handleJoin = () => {
    if (roomId.trim()) {
      socket.connect();
      setJoined(true); // This swaps the UI to show the Editor
    }
  };

  // 3. Triggered by Monaco mounting
  const handleEditorOnMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.focus();

    // ONLY join the room here. This ensures that when 'init_code'
    // arrives, the editor is ready to display it.
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

  // 2. Wrap requestSync so its "identity" is stable
  const requestSync = useCallback(() => {
    if (roomId && joined) {
      console.log("Requesting full sync...");
      socket.emit("request_full_sync", roomId);
    }
  }, [roomId, joined]); // Only re-create if these change

  useEffect(() => {
    // 3. This now runs only when the socket connects or requestSync identity changes
    const handleReconnect = () => {
      requestSync();
    };

    socket.on("connect", handleReconnect);

    return () => {
      socket.off("connect", handleReconnect);
    };
  }, [requestSync]); // Now safe to include

  if (!joined) {
    return (
      <div style={joinScreenStyles}>
        <h1>Collaborative Editor</h1>
        <input
          type="text"
          placeholder="Enter Room ID..."
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          style={inputStyles}
        />
        <button onClick={handleJoin} style={buttonStyles}>
          Join Room
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh" }}>
      <div style={headerStyles}>
        Room: <strong>{roomId}</strong>
      </div>
      <Editor
        height="calc(100% - 40px)"
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

// Minimalist styles for clarity
const joinScreenStyles: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100vh",
  backgroundColor: "#1e1e1e",
  color: "white",
  gap: "20px",
};
const inputStyles: React.CSSProperties = {
  padding: "10px",
  borderRadius: "5px",
  border: "none",
  width: "250px",
};
const buttonStyles: React.CSSProperties = {
  padding: "10px 20px",
  cursor: "pointer",
  backgroundColor: "#007acc",
  color: "white",
  border: "none",
  borderRadius: "5px",
};
const headerStyles: React.CSSProperties = {
  padding: "10px",
  background: "#333",
  color: "white",
  fontSize: "14px",
};
