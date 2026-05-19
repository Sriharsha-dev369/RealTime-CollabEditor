import { useEffect, useRef } from "react";
import { socket } from "../socket";
import { CLIENT_EVENTS, SERVER_EVENTS } from "../socket/events";
import type { MonacoChange, RoomJoinedPayload } from "../types/collabration";
import { useRemoteCursors } from "./useRemoteCursors";
import * as monaco from "monaco-editor";

export const useCollaboration = (
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>,
  currentFileId: React.MutableRefObject<string | null>,
  userId: string,
  roomId: string,
  name: string,
  setError?: (error: string | null) => void,
) => {
  const isRemoteChangeRef = useRef(false);
  const userMap = useRef<Map<string, { name: string; color: string }>>(
    new Map(),
  );
  const hasJoined = useRef(false);
  const isConnectedRef = useRef(true);
  const offlineQueue = useRef<{ fileId: string; changes: MonacoChange[] }[]>(
    [],
  );

  const { applyCursor, removeCursor, injectUserStyle } =
    useRemoteCursors(editorRef);

  useEffect(() => {
    const handleRoomJoined = (data: RoomJoinedPayload) => {
      const isReconnect = hasJoined.current;
      hasJoined.current = true;
      isConnectedRef.current = true;

      // Always rebuild userMap from fresh server state
      userMap.current.clear();
      data.users.forEach((u) => {
        userMap.current.set(u.userId, { name: u.name, color: u.color });
        injectUserStyle(u.userId, u.color, u.name);
      });

      if (isReconnect) {
        // Resync editor to server state (server wins)
        const file = data.files[0];
        if (file && editorRef.current) {
          isRemoteChangeRef.current = true;
          editorRef.current.setValue(file.content);
          isRemoteChangeRef.current = false;
          currentFileId.current = file.id;
        }
        // Restore our cursor so other users see us again
        const pos = editorRef.current?.getPosition();
        if (pos) {
          socket.emit(CLIENT_EVENTS.CURSOR_UPDATE, {
            fileId: currentFileId.current ?? "",
            line: pos.lineNumber,
            col: pos.column,
          });
        }
        // Discard offline queue — server state is authoritative
        offlineQueue.current = [];
      }
    };

    const handleConnect = () => {
      if (!hasJoined.current) return; // Initial connect — CodeEditor handles it
      isConnectedRef.current = true;
      socket.emit(CLIENT_EVENTS.ROOM_JOIN, { roomId, userId, name });
    };

    const handleDisconnect = () => {
      isConnectedRef.current = false;
    };

    const handleFileUpdated = (data: {
      fileId: string;
      changes: MonacoChange[];
      userId: string;
    }) => {
      try {
        if (!data || !Array.isArray(data.changes) || data.changes.length === 0)
          return;
        if (!editorRef.current) return;

        isRemoteChangeRef.current = true;
        editorRef.current.executeEdits(
          "remote",
          data.changes.map((c) => ({
            range: c.range,
            text: c.text,
            forceMoveMarkers: true,
          })),
        );
        isRemoteChangeRef.current = false;
      } catch (err) {
        console.error("Error in handleFileUpdated:", err);
        setError?.("Failed to apply remote changes");
        isRemoteChangeRef.current = false;
      }
    };

    const handleCursorUpdated = (data: {
      userId: string;
      fileId: string;
      line: number;
      col: number;
    }) => {
      try {
        const user = userMap.current.get(data.userId);
        if (!user) return;
        applyCursor({
          userId: data.userId,
          line: data.line,
          col: data.col,
          color: user.color,
          name: user.name,
        });
      } catch (err) {
        console.error("Error in handleCursorUpdated:", err);
      }
    };

    const handleUserJoined = (data: {
      userId: string;
      name: string;
      color: string;
    }) => {
      try {
        userMap.current.set(data.userId, {
          name: data.name,
          color: data.color,
        });
        injectUserStyle(data.userId, data.color, data.name);
        // Announce our cursor to the new user
        if (editorRef.current) {
          const pos = editorRef.current.getPosition();
          if (pos) {
            socket.emit(CLIENT_EVENTS.CURSOR_UPDATE, {
              fileId: currentFileId.current ?? "",
              line: pos.lineNumber,
              col: pos.column,
            });
          }
        }
      } catch (err) {
        console.error("Error in handleUserJoined:", err);
      }
    };

    const handleUserLeft = ({ userId }: { userId: string }) => {
      try {
        userMap.current.delete(userId);
        removeCursor(userId);
      } catch (err) {
        console.error("Error in handleUserLeft:", err);
      }
    };

    const handleSocketError = (error: { message?: string } | null) => {
      console.error("Socket error:", error);
      setError?.("Connection error occurred");
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on(SERVER_EVENTS.ROOM_JOINED, handleRoomJoined);
    socket.on(SERVER_EVENTS.FILE_UPDATED, handleFileUpdated);
    socket.on(SERVER_EVENTS.CURSOR_UPDATED, handleCursorUpdated);
    socket.on(SERVER_EVENTS.USER_JOINED, handleUserJoined);
    socket.on(SERVER_EVENTS.USER_LEFT, handleUserLeft);
    socket.on(SERVER_EVENTS.ERROR, handleSocketError);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off(SERVER_EVENTS.ROOM_JOINED, handleRoomJoined);
      socket.off(SERVER_EVENTS.FILE_UPDATED, handleFileUpdated);
      socket.off(SERVER_EVENTS.CURSOR_UPDATED, handleCursorUpdated);
      socket.off(SERVER_EVENTS.USER_JOINED, handleUserJoined);
      socket.off(SERVER_EVENTS.USER_LEFT, handleUserLeft);
      socket.off(SERVER_EVENTS.ERROR, handleSocketError);
    };
  }, [
    userId,
    roomId,
    name,
    editorRef,
    currentFileId,
    applyCursor,
    removeCursor,
    injectUserStyle,
    setError,
  ]);

  return { isRemoteChangeRef, isConnectedRef, offlineQueue };
};
