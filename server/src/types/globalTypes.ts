export type EditorFile = {
  id: string;
  name: string;
  content: string;
  language: string;
  updatedAt: Date;
  version: number;
};

export type Room = {
  id: string;
  ownerId: string;

  users: Set<string>;
  roles?: Map<string, "owner" | "editor" | "viewer">;

  files: Map<string, EditorFile>;
  fileOrder?: string[];

  activeFileId?: string;

  createdAt: Date;
  lastActiveAt?: Date;
};

export type UserState = {
  userId: string;
  name: string;
  color: string;

  socketIds: Set<string>;

  activeFileId?: string;
  cursor?: { line: number; col: number };
};
