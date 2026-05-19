import { useState, useEffect, useRef } from "react";
import { socket } from "../socket";
import { SERVER_EVENTS } from "../socket/events";
import type { UserData, RoomJoinedPayload } from "../types/collabration";

export const useUsersList = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const idleTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  useEffect(() => {
    const handleRoomJoined = (data: RoomJoinedPayload) => {
      setUsers(
        data.users.map((u) => ({
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

    const handleUserLeft = ({ userId }: { userId: string }) => {
      setUsers((prev) => prev.filter((u) => u.userId !== userId));
      const timer = idleTimers.current.get(userId);
      if (timer) {
        clearTimeout(timer);
        idleTimers.current.delete(userId);
      }
    };

    socket.on(SERVER_EVENTS.ROOM_JOINED, handleRoomJoined);
    socket.on(SERVER_EVENTS.USER_JOINED, handleNewUser);
    socket.on(SERVER_EVENTS.USER_LEFT, handleUserLeft);

    const timers = idleTimers.current;

    return () => {
      socket.off(SERVER_EVENTS.ROOM_JOINED, handleRoomJoined);
      socket.off(SERVER_EVENTS.USER_JOINED, handleNewUser);
      socket.off(SERVER_EVENTS.USER_LEFT, handleUserLeft);

      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  return { users };
};
