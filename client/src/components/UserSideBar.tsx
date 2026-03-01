import { useState } from "react";
import { useUsersList } from "../hooks/usersList";

// const USERS = [
//   { id: 1, name: "Alex Rivera",  color: "#4ade80", status: "editing" },
//   { id: 2, name: "Sam Okafor",   color: "#60a5fa", status: "viewing" },
//   { id: 3, name: "Priya Mehta",  color: "#f472b6", status: "idle" },
//   { id: 4, name: "Jordan Levi",  color: "#fb923c", status: "editing" },
//   { id: 5, name: "Mia Chen",     color: "#a78bfa", status: "viewing" },
//   { id: 6, name: "Tariq Hassan", color: "#34d399", status: "idle" },
// ];

const STATUS = {
  editing: { label: "Editing", dot: "#4ade80" },
  viewing: { label: "Viewing", dot: "#60a5fa" },
  idle: { label: "Idle", dot: "#6b7280" },
};

// const initials = (name) =>
//   name.split(" ").map(n => n[0]).join("");

// const Avatar = ({ user, size = 30 }) => (
//   <div
//     className="flex items-center justify-center rounded-full font-bold"
//     style={{
//       width: size,
//       height: size,
//       background: user.color + "18",
//       border: `1.5px solid ${user.color}55`,
//       color: user.color,
//       fontSize: size * 0.4,
//     }}
//   >
//     {initials(user.name)}
//   </div>
// );

// const StatusDot = ({ status }) => (
//   <span
//     className="inline-block rounded-full"
//     style={{
//       width: 6,
//       height: 6,
//       background: STATUS[status].dot,
//       boxShadow:
//         status === "editing"
//           ? `0 0 6px ${STATUS[status].dot}`
//           : "none",
//     }}
//   />
// );

export function UsersSideBar() {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const { users } = useUsersList();

  const filtered = users.filter((u) =>
    u.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-[#0e0e10] font-mono relative">
      {/* Fake editor */}
      <div className="p-10 text-[#3d3d44] text-sm leading-loose select-none">
        {[
          "const doc = useDocument();",
          "const { users } = useCollabSession(doc.id);",
          "",
          "function Editor() {",
          "  return (",
          '    <EditorRoot className="collab-editor">',
          "      <EditorContent />",
          "    </EditorRoot>",
          "  );",
          "}",
        ].map((line, i) => (
          <div key={i}>
            <span className="text-[#28282f] mr-6">
              {String(i + 1).padStart(2, "0")}
            </span>
            {line}
          </div>
        ))}
      </div>

      {/* Toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed top-1/2 -translate-y-1/2 z-50 w-6 h-12 flex items-center justify-center 
        bg-[#1a1a1f] border border-[#2e2e38] rounded-md text-gray-400 shadow-lg
        transition-all duration-300`}
        style={{ right: open ? "calc(50% - 12px)" : 12 }}
      >
        {open ? ">" : "<"}
      </button>

      {/* Sidebar */}
      <div
        className={`fixed top-[10%] h-[80%] w-1/2 bg-[#111114]
        border border-[#1f1f27] border-r-0 rounded-l-xl flex flex-col
        shadow-2xl transition-all duration-300`}
        style={{ right: open ? 0 : "-50%" }}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-[#1c1c24]">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-gray-200">
              Collaborators
            </p>
            <p className="text-xs text-gray-500 mt-1">{users.length} active</p>
          </div>

          {/* <div className="flex">
            {USERS.slice(0, 4).map((u, i) => (
              <div
                key={u.id}
                className="flex items-center justify-center rounded-full text-[9px] font-bold"
                style={{
                  width: 22,
                  height: 22,
                  background: u.color + "22",
                  border: `1.5px solid ${u.color}`,
                  color: u.color,
                  marginLeft: i === 0 ? 0 : -7,
                  zIndex: 4 - i,
                }}
              >
                {u.name[0]}
              </div>
            ))}
          </div> */}
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-[#1c1c24]">
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600">
              ⌕
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full pl-7 pr-2 py-1.5 text-sm rounded-md
              bg-[#0e0e12] border border-[#222230] text-gray-300
              focus:border-[#33334a] outline-none"
            />
          </div>
        </div>

        {/*Demo users*/}
        <div className="flex-1 overflow-y-auto py-2">
          {filtered.map((user, index) => (
            <div
              key={index} // This removes the "unique key" warning
              className="flex items-center gap-3 px-5 py-2 hover:bg-[#17171d]"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200 truncate">{user}</p>
              </div>
            </div>
          ))}
        </div>


        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-[#1c1c24]">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_#4ade80]" />
          <span className="text-xs tracking-widest text-gray-500">
            LIVE SESSION
          </span>
        </div>
      </div>
    </div>
  );
}


// {/* Users */}
//         <div className="flex-1 overflow-y-auto py-2">
//           {filtered.length === 0 ? (
//             <p className="text-center text-xs text-gray-600 mt-8">
//               No users found
//             </p>
//           ) : (
//             filtered.map((user) => (
//               <div
//                 // key={user.id}
//                 className="flex items-center gap-3 px-5 py-2 hover:bg-[#17171d]"
//               >
//                 {/* <Avatar user={user} /> */}

//                 <div className="flex-1 min-w-0">
//                   <p className="text-sm text-gray-200 truncate">{user}</p>

//                   {/* <div className="flex items-center gap-1 mt-1">
//                     <StatusDot status={user.status} />
//                     <span className="text-[10px] tracking-widest text-gray-500">
//                       {STATUS[user.status].label}
//                     </span>
//                   </div> */}
//                 </div>
//               </div>
//             ))
//           )}
//         </div>
//         <div className="px-5 py-2 text-xs text-gray-500">
//           {users.length} users in this room
//         </div>
