import { useState, useRef, useEffect } from "react";
import type { EditorFile } from "../types/collabration";

interface FileSideBarProps {
  files: EditorFile[];
  activeFileId: string | null;
  onFileSelect: (fileId: string) => void;
  onFileCreate: (name: string) => void;
}

const FILE_ICON: Record<string, string> = {
  typescript: "ts",
  javascript: "js",
  python: "py",
  css: "css",
  html: "html",
  json: "{}",
  plaintext: "txt",
};

function fileIcon(language: string): string {
  return FILE_ICON[language] ?? "…";
}

export function FileSideBar({
  files,
  activeFileId,
  onFileSelect,
  onFileCreate,
}: FileSideBarProps) {
  const [open, setOpen] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const commitCreate = () => {
    const trimmed = newName.trim();
    if (trimmed) onFileCreate(trimmed);
    setCreating(false);
    setNewName("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commitCreate();
    if (e.key === "Escape") {
      setCreating(false);
      setNewName("");
    }
  };

  return (
    <div
      className={`flex flex-col bg-[#0e0e12] border-r border-[#1a1a1f] shrink-0 overflow-hidden transition-all duration-300 ${
        open ? "w-52" : "w-0"
      }`}
    >
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-50 w-5 h-10 flex items-center justify-center bg-[#18181b] border border-[#27272a] border-l-0 rounded-r-md text-zinc-500 text-xs hover:text-zinc-300 transition-colors"
        style={{ left: open ? 208 : 0 }}
      >
        {open ? "‹" : "›"}
      </button>

      {/* Header */}
      <div className="flex justify-between items-center px-3 py-3 border-b border-[#1a1a1f]">
        <div>
          <p className="text-[11px] font-semibold tracking-widest uppercase text-zinc-300">
            Files
          </p>
          <p className="text-[10px] text-zinc-600 mt-0.5">{files.length} file{files.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          title="New file"
          className="w-5 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-200 hover:bg-[#222230] transition-colors text-sm leading-none"
        >
          +
        </button>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto py-1">
        {files.map((file) => {
          const isActive = file.id === activeFileId;
          return (
            <button
              key={file.id}
              onClick={() => onFileSelect(file.id)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                isActive
                  ? "bg-[#1a1a2e] text-zinc-100"
                  : "text-zinc-400 hover:bg-[#14141a] hover:text-zinc-200"
              }`}
            >
              <span
                className={`text-[9px] font-bold w-6 shrink-0 text-center rounded px-0.5 py-0.5 ${
                  isActive ? "bg-indigo-500/20 text-indigo-400" : "bg-zinc-800 text-zinc-500"
                }`}
              >
                {fileIcon(file.language)}
              </span>
              <span className="text-[12px] truncate">{file.name}</span>
            </button>
          );
        })}

        {/* Inline new-file input */}
        {creating && (
          <div className="flex items-center gap-2 px-3 py-1.5">
            <span className="text-[9px] font-bold w-6 shrink-0 text-center rounded px-0.5 py-0.5 bg-zinc-800 text-zinc-500">
              …
            </span>
            <input
              ref={inputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={commitCreate}
              placeholder="filename"
              className="flex-1 text-[12px] bg-transparent border-b border-zinc-600 text-zinc-200 outline-none placeholder:text-zinc-700 py-0.5"
            />
          </div>
        )}

        {files.length === 0 && !creating && (
          <p className="text-center text-[11px] text-zinc-700 mt-6">No files</p>
        )}
      </div>
    </div>
  );
}
