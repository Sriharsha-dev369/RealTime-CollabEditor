// useUsersList.ts
import { useState, useEffect, useRef } from "react";
import { socket } from "../socket";
import type { UserData } from "../types/collabration";

export const useUsersList = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const idleTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  useEffect(() => {
    const handleInitialList = (list: UserData[]) => {
      setUsers(
        list.map((u) => ({
          userId: u.userId,
          name: u.name,
          color: u.color,
          status: "viewing" as const,
        })),
      );
    };

    const handleNewUser = (data: UserData) => {
      setUsers((prev) => {
        if (prev.some((u) => u.userId === data.userId)) return prev;
        return [
          ...prev,
          {
            userId: data.userId,
            name: data.name,
            color: data.color,
            status: "viewing" as const,
          },
        ];
      });
    };

    const handleUserLeft = (userId: string) => {
      setUsers((prev) => prev.filter((u) => u.userId !== userId));
      const timer = idleTimers.current.get(userId);
      if (timer) {
        clearTimeout(timer);
        idleTimers.current.delete(userId);
      }
    };

    const handleStatusChange = (data: { userId: string; status: string }) => {
      setUsers((prev) =>
        prev.map((u) =>
          u.userId === data.userId
            ? { ...u, status: data.status as UserData["status"] }
            : u,
        ),
      );

      if (data.status === "editing" || data.status === "viewing") {
        const existing = idleTimers.current.get(data.userId);
        if (existing) clearTimeout(existing);

        const delay = data.status === "editing" ? 3000 : 5000;
        idleTimers.current.set(
          data.userId,
          setTimeout(() => {
            setUsers((prev) =>
              prev.map((u) =>
                u.userId === data.userId ? { ...u, status: "idle" } : u,
              ),
            );
            idleTimers.current.delete(data.userId);
          }, delay),
        );
      }
    };

    socket.on("current_user_list", handleInitialList);
    socket.on("new_user_joined", handleNewUser);
    socket.on("user_left", handleUserLeft);
    socket.on("user_status_change", handleStatusChange);

    return () => {
      socket.off("current_user_list", handleInitialList);
      socket.off("new_user_joined", handleNewUser);
      socket.off("user_left", handleUserLeft);
      socket.off("user_status_change", handleStatusChange);

      idleTimers.current.forEach((t) => clearTimeout(t));
      idleTimers.current.clear();
    };
  }, []);

  return { users };
};
