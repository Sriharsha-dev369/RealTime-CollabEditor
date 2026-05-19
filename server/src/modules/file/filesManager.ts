import { randomUUID } from "node:crypto";
import { rooms } from "../../store/index.js";
import type { EditorFile } from "../../types/globalTypes.js";
import { applyChanges } from "../../utils/applyChanges.js";

export function createFile(
  roomId: string,
  name: string,
  language: string,
): EditorFile | undefined {
  const room = rooms.get(roomId);
  if (!room) return undefined;

  const file: EditorFile = {
    id: randomUUID(),
    name,
    content: "",
    language,
    version: 0,
    updatedAt: new Date(),
  };

  room.files.set(file.id, file);
  return file;
}

export function updateFile(
  roomId: string,
  fileId: string,
  changes: unknown[],
): EditorFile | undefined {
  const file = rooms.get(roomId)?.files.get(fileId);
  if (!file) return undefined;

  file.content = applyChanges(file.content, changes);
  file.version += 1;
  file.updatedAt = new Date();
  return file;
}

export function getFile(
  roomId: string,
  fileId: string,
): EditorFile | undefined {
  return rooms.get(roomId)?.files.get(fileId);
}

export function getRoomFiles(
  roomId: string,
): Map<string, EditorFile> | undefined {
  return rooms.get(roomId)?.files;
}
