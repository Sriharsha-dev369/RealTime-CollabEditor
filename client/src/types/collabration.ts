import * as monaco from "monaco-editor";

export interface MonacoChange {
  range: monaco.IRange;
  text: string;
  rangeOffset: number;
  rangeLength: number;
}

export interface RemoteCursorData {
  userId: string;
  position: monaco.IPosition;
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
  roomId: string;
}
