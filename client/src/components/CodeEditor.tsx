import { useEffect, useRef, useState, useCallback } from "react";
import Editor, { type OnMount, type OnChange } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { socket } from "../socket";
import * as monaco from "monaco-editor";
import "./style.css";

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

interface RemoteCursorData {
  userId: string;
  position: monaco.IPosition;
  color: string;
  name: string;
}

export default function CodeEditor() {
  const [roomId, setRoomId] = useState<string>("");
  const [joined, setJoined] = useState(false);
  const roomIdRef = useRef(roomId);
  const joinedRef = useRef(joined);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    joinedRef.current = joined;
  }, [joined]);

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const isRemoteChange = useRef(false);
  const remoteCursors = useRef<{ [key: string]: string[] }>({});
  const knownUsers = useRef<Set<string>>(new Set());

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

    const injectUserStyle = (userId: string, color: string, name: string) => {
      if (knownUsers.current.has(userId)) return;
      const styleId = `style-${userId}`;

      const style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = `
    .cursor-${userId} { 
      border-left-color: ${color} !important; 
    }
    .label-${userId}::before { 
      content: "${name}"; 
      background-color: ${color} !important; 
    }
  `;
      document.head.appendChild(style); // MAKE SURE THIS LINE IS HERE
      knownUsers.current.add(userId);
    };

    const handleReceiveCursor = (data: RemoteCursorData) => {
      const editorInstance = editorRef.current;
      const model = editorInstance?.getModel();

      if (!editorInstance || !model) return;

      const { userId, position, color, name } = data;

      injectUserStyle(userId, color, name);

      const newDecorations: monaco.editor.IModelDeltaDecoration[] = [
        {
          range: new monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column,
          ),
          options: {
            className: `remote-cursor cursor-${userId}`,
            // This places the label node at the cursor position
            beforeContentClassName: `cursor-label label-${userId}`,
            stickiness:
              monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        },
      ];

      // UPDATED: Use model.deltaDecorations instead of editor.deltaDecorations
      remoteCursors.current[userId] = model.deltaDecorations(
        remoteCursors.current[userId] || [],
        newDecorations,
      );
    };

    const handleUserLeft = (userId: string) => {
      const model = editorRef.current?.getModel();
      if (model && remoteCursors.current[userId]) {
        model.deltaDecorations(remoteCursors.current[userId], []);
        delete remoteCursors.current[userId];
        document.getElementById(`style-${userId}`)?.remove();
      }
    };

    const handleNewUserJoined = () => {
      if (editorRef.current) {
        socket.emit("cursor_move", {
          roomId: roomIdRef.current,
          position: editorRef.current.getPosition(),
        });
      }
    };

    socket.on("init_code", handleInitCode);
    socket.on("receive_delta", handleReceiveDelta);
    socket.on("receive_cursor", handleReceiveCursor);
    socket.on("user_left", handleUserLeft);
    socket.on("new_user_joined", handleNewUserJoined);

    return () => {
      socket.off("init_code", handleInitCode);
      socket.off("receive_delta", handleReceiveDelta);
      socket.off("receive_cursor", handleReceiveCursor);
      socket.off("user_left", handleUserLeft);
      socket.off("new_user_joined", handleNewUserJoined);
      socket.disconnect();
    };
  }, []);

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
        socket.emit("cursor_move", {
          roomId: roomIdRef.current,
          position: e.position,
        });
        lastEmit = now;
      }
    });

    socket.emit("join_room", roomIdRef.current);
  };

  const handleEditorChange: OnChange = (_value, event) => {
    if (isRemoteChange.current || !event.changes) return;

    socket.emit("code_delta", {
      roomId: roomIdRef.current,
      changes: event.changes.map((c) => ({
        range: c.range,
        text: c.text,
        rangeOffset: c.rangeOffset,
        rangeLength: c.rangeLength,
      })),
    });
  };

  const requestSync = useCallback(() => {
    const currentRoom = roomIdRef.current;
    const isJoined = joinedRef.current; 

    if (currentRoom && isJoined) {
      console.log("Requesting full sync...");
      socket.emit("request_full_sync", currentRoom);
    }
  }, []); 

  useEffect(() => {
    const handleReconnect = () => requestSync();

    socket.on("connect", handleReconnect);
    return () => {
      socket.off("connect", handleReconnect);
    };
  }, [requestSync]);

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
