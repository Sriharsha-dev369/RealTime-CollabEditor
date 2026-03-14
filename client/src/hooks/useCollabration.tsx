import { useEffect, useRef } from "react";
import { socket } from "../socket";
import type { MonacoChange, RemoteCursorData } from "../types/collabration";
import { useRemoteCursors } from "./useRemoteCursors";
import * as monaco from "monaco-editor";

export const useCollaboration = (
  roomId: string,
  joined: boolean,
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>,
  setError?: (error: string | null) => void,
) => {
  const isRemoteChange = useRef(false);
  const { applyCursor, applySelection, removeCursor, injectUserStyle } =
    useRemoteCursors(editorRef);

  useEffect(() => {
    if (!joined) return;

    const handleInitCode = (fullCode: string) => {
      try {
        if (!fullCode || typeof fullCode !== "string") {
          console.error("Invalid init_code data:", fullCode);
          return;
        }
        if (editorRef.current) {
          isRemoteChange.current = true;
          editorRef.current.setValue(fullCode);
          isRemoteChange.current = false;
        }
      } catch (err) {
        console.error("Error in handleInitCode:", err);
        setError?.("Failed to load initial code");
      }
    };

    const handleReceiveDelta = (data: { changes?: MonacoChange[] }) => {
      try {
        if (
          !data ||
          !Array.isArray(data.changes) ||
          data.changes.length === 0
        ) {
          console.error("Invalid receive_delta data:", data);
          return;
        }
        if (!editorRef.current) return;

        isRemoteChange.current = true;
        editorRef.current.executeEdits(
          "remote",
          data.changes.map((c) => ({
            range: c.range,
            text: c.text,
            forceMoveMarkers: true,
          })),
        );
        isRemoteChange.current = false;
      } catch (err) {
        console.error("Error in handleReceiveDelta:", err);
        setError?.("Failed to apply remote changes");
        isRemoteChange.current = false;
      }
    };

    const handleNewUserJoined = (data: RemoteCursorData) => {
      try {
        if (!data || typeof data !== "object") {
          console.error("Invalid new_user_joined data:", data);
          return;
        }
        if (data.userId && data.color) {
          injectUserStyle(data.userId, data.color, data.name);
        }
        if (editorRef.current) {
          socket.emit("cursor_move", {
            position: editorRef.current.getPosition(),
          });
        }
      } catch (err) {
        console.error("Error in handleNewUserJoined:", err);
      }
    };

    const requestSync = () => {
      try {
        if (!roomId) {
          console.error("Cannot request sync: roomId is empty");
          return;
        }
        socket.emit("request_full_sync", roomId);
      } catch (err) {
        console.error("Error in requestSync:", err);
      }
    };

    const handleSocketError = (error: Error | null) => {
      console.error("Socket error:", error);
      setError?.("Connection error occurred");
    };

    socket.on("init_code", handleInitCode);
    socket.on("receive_delta", handleReceiveDelta);
    socket.on("receive_cursor", applyCursor);
    socket.on("receive_selection", applySelection);
    socket.on("user_left", removeCursor);
    socket.on("new_user_joined", handleNewUserJoined);
    socket.on("connect", requestSync);
    socket.on("error", handleSocketError);

    return () => {
      socket.off("init_code", handleInitCode);
      socket.off("receive_delta", handleReceiveDelta);
      socket.off("receive_cursor", applyCursor);
      socket.off("receive_selection", applySelection);
      socket.off("user_left", removeCursor);
      socket.off("new_user_joined", handleNewUserJoined);
      socket.off("connect", requestSync);
      socket.off("error", handleSocketError);
    };
  }, [
    joined,
    roomId,
    editorRef,
    applyCursor,
    applySelection,
    removeCursor,
    injectUserStyle,
    setError,
  ]);

  return { isRemoteChange };
};
