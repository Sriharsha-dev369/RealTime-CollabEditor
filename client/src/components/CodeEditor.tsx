import { useEffect, useRef, useState, useCallback } from "react";
import Editor, { type OnMount, type OnChange } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { socket } from "../socket";
import "../style.css";

interface MonacoChange {
  range: monaco.IRange;
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

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const isRemoteChange = useRef(false);
  const remoteCursors = useRef<{ [key: string]: string[] }>({});
  const knownUsers = useRef<Set<string>>(new Set());
  const styleSheetRef = useRef<HTMLStyleElement | null>(null);

  // 1. Setup global style sheet for cursors
  useEffect(() => {
    if (!styleSheetRef.current) {
      const style = document.createElement("style");
      style.id = "monaco-remote-cursor-styles";
      document.head.appendChild(style);
      styleSheetRef.current = style;
    }
  }, []);

  const injectUserStyle = (userId: string, color: string, name: string) => {
    if (knownUsers.current.has(userId) || !styleSheetRef.current?.sheet) return;

    try {
      const sheet = styleSheetRef.current.sheet;

      // Rule 1: The cursor line color
      sheet.insertRule(
        `.cursor-${userId} { border-left: 2px solid ${color} !important; }`,
        sheet.cssRules.length,
      );

      // Rule 2: The name tag content and background
      sheet.insertRule(
        `.label-${userId}::before { content: "${name}"; background-color: ${color} !important; }`,
        sheet.cssRules.length,
      );

      knownUsers.current.add(userId);
    } catch (e) {
      console.error("CSS Injection failed:", e);
    }
  };

  // 2. Socket Listeners (Dependent on 'joined' to have fresh scope)
  useEffect(() => {
    if (!joined) return;

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
        "remote",
        data.changes.map((change) => ({
          range: change.range,
          text: change.text,
          forceMoveMarkers: true,
        })),
      );
      isRemoteChange.current = false;
    };

    const handleReceiveCursor = (data: RemoteCursorData) => {
      const model = editorRef.current?.getModel();
      if (!model) return;

      injectUserStyle(data.userId, data.color, data.name);

      const newDecorations: monaco.editor.IModelDeltaDecoration[] = [
        {
          range: new monaco.Range(
            data.position.lineNumber,
            data.position.column,
            data.position.lineNumber,
            data.position.column,
          ),
          options: {
            className: `remote-cursor cursor-${data.userId}`,
            beforeContentClassName: `cursor-label label-${data.userId}`,
            stickiness:
              monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        },
      ];

      remoteCursors.current[data.userId] = model.deltaDecorations(
        remoteCursors.current[data.userId] || [],
        newDecorations,
      );
    };

    const handleUserLeft = (userId: string) => {
      const model = editorRef.current?.getModel();
      if (model && remoteCursors.current[userId]) {
        model.deltaDecorations(remoteCursors.current[userId], []);
        delete remoteCursors.current[userId];
      }
    };

    const handleNewUserJoined = (data: RemoteCursorData) => {
      // 1. Immediately inject the style so we are ready for them
      if (data.userId && data.color) {
        injectUserStyle(data.userId, data.color, data.name);
      }

      // 2. Respond by sending OUR cursor position to the new user
      // so they see us immediately without waiting for us to move
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
  }, [joined]);

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

// ... (Styles stay as they were in your code)
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
