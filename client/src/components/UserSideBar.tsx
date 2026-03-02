import { useState } from "react";
import { useUsersList } from "../hooks/usersList";
import type { UserData } from "../types/collabration";

const STATUS = {
  editing: { label: "Editing", dot: "bg-green-400 shadow-[0_0_6px_#4ade80]" },
  viewing: { label: "Viewing", dot: "bg-blue-400 shadow-[0_0_6px_#60a5fa]" },
  idle: { label: "Idle", dot: "bg-zinc-500" },
};

const initials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").toUpperCase();

const Avatar = ({ user, size = 28 }: { user: UserData; size?: number }) => (
  <div
    className="flex items-center justify-center rounded-full font-semibold shrink-0"
    style={{
      width: size,
      height: size,
      background: user.color + "15",
      border: `1.5px solid ${user.color}44`,
      color: user.color,
      fontSize: size * 0.38,
    }}
  >
    {initials(user.name)}
  </div>
);

const StatusDot = ({ status }: { status: NonNullable<UserData["status"]> }) => (
  <span className={`inline-block w-1.5 h-1.5 rounded-full ${STATUS[status].dot}`} />
);

export function UsersSideBar() {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const { users } = useUsersList();

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div
      className={`flex flex-col bg-[#0e0e12] border-l border-[#1a1a1f] shrink-0 overflow-hidden transition-all duration-300 ${open ? "w-60" : "w-0"
        }`}
    >
      {/* Toggle button – always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-50 w-5 h-10 flex items-center justify-center bg-[#18181b] border border-[#27272a] border-r-0 rounded-l-md text-zinc-500 text-xs hover:text-zinc-300 transition-colors"
        style={{ right: open ? 240 : 0 }}
      >
        {open ? "›" : "‹"}
      </button>

      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-[#1a1a1f]">
        <div>
          <p className="text-[11px] font-semibold tracking-widest uppercase text-zinc-300">
            Users
          </p>
          <p className="text-[10px] text-zinc-600 mt-0.5">
            {users.length} online
          </p>
        </div>

        {/* Avatar stack */}
        <div className="flex -space-x-2">
          {users.slice(0, 3).map((u) => (
            <div
              key={u.userId}
              className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ring-1 ring-[#0e0e12]"
              style={{
                background: u.color + "22",
                color: u.color,
              }}
            >
              {u.name[0]}
            </div>
          ))}
          {users.length > 3 && (
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-medium bg-zinc-800 text-zinc-400 ring-1 ring-[#0e0e12]">
              +{users.length - 3}
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-[#1a1a1f]">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="w-full px-2.5 py-1.5 text-xs rounded-md bg-[#0a0a0c] border border-[#222230] text-zinc-300 outline-none transition-colors focus:border-zinc-600 placeholder:text-zinc-700"
        />
      </div>

      {/* User list */}
      <div className="flex-1 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <p className="text-center text-[11px] text-zinc-700 mt-6">
            No users found
          </p>
        ) : (
          filtered.map((user) => (
            <div
              key={user.userId}
              className="flex items-center gap-2.5 px-4 py-2 hover:bg-[#14141a] transition-colors cursor-default"
            >
              <Avatar user={user} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-zinc-200 truncate leading-tight">
                  {user.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <StatusDot status={user.status ?? "viewing"} />
                  <span className="text-[10px] text-zinc-500">
                    {STATUS[user.status ?? "viewing"].label}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-[#1a1a1f]">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_#4ade80]" />
        <span className="text-[10px] tracking-widest text-zinc-600 uppercase">
          Live
        </span>
      </div>
    </div>
  );
}
