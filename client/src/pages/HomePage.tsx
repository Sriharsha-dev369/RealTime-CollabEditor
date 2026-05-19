import { useState } from "react";

const ROOM_ID_RE = /^[a-zA-Z0-9_-]+$/;

function validateRoomId(v: string): string | null {
  const s = v.trim();
  if (!s) return "Required";
  if (s.length < 2) return "At least 2 characters";
  if (s.length > 50) return "Max 50 characters";
  if (!ROOM_ID_RE.test(s))
    return "Letters, numbers, hyphens and underscores only";
  return null;
}

function validateName(v: string): string | null {
  const s = v.trim();
  if (!s) return "Required";
  if (s.length < 2) return "At least 2 characters";
  if (s.length > 30) return "Max 30 characters";
  return null;
}

function FormField({
  label,
  value,
  placeholder,
  error,
  onChange,
  onBlur,
  onKeyDown,
}: {
  label: string;
  value: string;
  placeholder: string;
  error?: string | null;
  onChange: (v: string) => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-500 mb-1.5 tracking-wider">
        {label}
      </label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className={`w-full px-3.5 py-2.5 rounded-lg border bg-[#0a0a0c] text-zinc-200 text-sm outline-none transition-colors placeholder:text-zinc-700 ${
          error
            ? "border-red-500/50 focus:border-red-500/70"
            : "border-zinc-800 focus:border-zinc-600"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

interface HomePageProps {
  onJoin: (roomId: string, name: string) => void;
  error: string | null;
  isConnecting: boolean;
}

export default function HomePage({
  onJoin,
  error,
  isConnecting,
}: HomePageProps) {
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    roomId?: string | null;
    name?: string | null;
  }>({});

  const canJoin =
    !validateRoomId(roomId) && !validateName(name) && !isConnecting;

  const handleJoin = () => {
    const roomErr = validateRoomId(roomId);
    const nameErr = validateName(name);
    if (roomErr || nameErr) {
      setFieldErrors({ roomId: roomErr, name: nameErr });
      return;
    }
    setFieldErrors({});
    onJoin(roomId.trim(), name.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && canJoin) handleJoin();
  };

  return (
    <div className="flex items-center justify-center h-screen bg-[#08080a] font-sans">
      <div className="w-[380px] p-10 rounded-2xl bg-[#111114] border border-[#1e1e26]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-10 h-10 mx-auto mb-4 rounded-[10px] bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-lg font-bold">
            {"<>"}
          </div>
          <h1 className="text-xl font-semibold text-zinc-200 tracking-tight">
            CollabEdit
          </h1>
          <p className="text-[13px] text-zinc-600 mt-1.5">
            Real-time collaborative code editor
          </p>
        </div>

        {/* Inputs */}
        <div className="flex flex-col gap-3">
          <FormField
            label="ROOM ID"
            value={roomId}
            placeholder="e.g. project-alpha"
            error={fieldErrors.roomId}
            onChange={(v) => {
              setRoomId(v);
              setFieldErrors((prev) => ({ ...prev, roomId: null }));
            }}
            onBlur={() =>
              setFieldErrors((prev) => ({
                ...prev,
                roomId: validateRoomId(roomId),
              }))
            }
            onKeyDown={handleKeyDown}
          />
          <FormField
            label="YOUR NAME"
            value={name}
            placeholder="e.g. Alex"
            error={fieldErrors.name}
            onChange={(v) => {
              setName(v);
              setFieldErrors((prev) => ({ ...prev, name: null }));
            }}
            onBlur={() =>
              setFieldErrors((prev) => ({
                ...prev,
                name: validateName(name),
              }))
            }
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* Connection Error */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Button */}
        <button
          onClick={handleJoin}
          disabled={!canJoin}
          className={`w-full mt-5 py-2.5 rounded-lg border-none text-sm font-semibold transition-opacity ${
            canJoin
              ? "bg-gradient-to-br from-indigo-500 to-violet-500 text-white cursor-pointer hover:opacity-90"
              : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
          }`}
        >
          {isConnecting ? "Connecting..." : "Join Room"}
        </button>
      </div>
    </div>
  );
}
