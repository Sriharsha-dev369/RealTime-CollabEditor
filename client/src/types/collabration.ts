import * as monaco from "monaco-editor";

export interface MonacoChange {
  range: monaco.IRange;
  text: string;
  rangeOffset: number;
  rangeLength: number;
}

export interface RemoteCursorData {
  userId: string;
  line: number;
  col: number;
  color: string;
  name: string;
}

export interface RemoteSelectionData {
  userId: string;
  selection: monaco.IRange;
  color: string;
  name: string;
}

export interface UserData {
  userId: string;
  name: string;
  color: string;
  roomId?: string;
  status?: "editing" | "viewing" | "idle";
}

export interface EditorFile {
  id: string;
  name: string;
  content: string;
  language: string;
}

export interface RoomJoinedPayload {
  roomId: string;
  userId: string;
  name: string;
  color: string;
  activeFileId?: string;
  files: EditorFile[];
  users: { userId: string; name: string; color: string }[];
}

export interface RoomCreatedPayload {
  roomId: string;
  userId: string;
  name: string;
  color: string;
  files: EditorFile[];
}
