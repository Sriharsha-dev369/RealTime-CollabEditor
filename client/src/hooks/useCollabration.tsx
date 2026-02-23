import { useEffect, useRef } from "react";
import { socket } from "../socket";
import type { MonacoChange, RemoteCursorData } from "../types/collabration";
import { useRemoteCursors } from "./useRemoteCursors";
import * as monaco from "monaco-editor";

export const useCollaboration = (
  roomId: string,
  joined: boolean,
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>
) => {
  const isRemoteChange = useRef(false);
  const { applyCursor, removeCursor, injectUserStyle } = useRemoteCursors(editorRef);

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
      if (!editorRef.current) return;
      isRemoteChange.current = true;
      editorRef.current.executeEdits("remote", data.changes.map((c) => ({
        range: c.range,
        text: c.text,
        forceMoveMarkers: true,
      })));
      isRemoteChange.current = false;
    };

    const handleNewUserJoined = (data: RemoteCursorData) => {
      if (data.userId && data.color) {
        injectUserStyle(data.userId, data.color, data.name);
      }
      if (editorRef.current) {
        socket.emit("cursor_move", { roomId, position: editorRef.current.getPosition() });
      }
    };

    const requestSync = () => socket.emit("request_full_sync", roomId);

    socket.on("init_code", handleInitCode);
    socket.on("receive_delta", handleReceiveDelta);
    socket.on("receive_cursor", applyCursor);
    socket.on("user_left", removeCursor);
    socket.on("new_user_joined", handleNewUserJoined);
    socket.on("connect", requestSync);

    return () => {
      socket.off("init_code", handleInitCode);
      socket.off("receive_delta", handleReceiveDelta);
      socket.off("receive_cursor", applyCursor);
      socket.off("user_left", removeCursor);
      socket.off("new_user_joined", handleNewUserJoined);
      socket.off("connect", requestSync);
      socket.disconnect();
    };
  }, [joined, roomId, editorRef, applyCursor, removeCursor, injectUserStyle]);

  return { isRemoteChange };
};