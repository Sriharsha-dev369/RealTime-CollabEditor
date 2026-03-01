// useUsersList.ts
import { useState, useEffect } from "react";
import { socket } from "../socket";
import type { UserData } from "../types/collabration";

export const useUsersList = () => {
  const [users, setUsers] = useState<string[]>([""]);

  useEffect(() => {
    // Scenario A: I am joining and getting the list of people already there
    const handleInitialList = (names: string[]) => {
      setUsers(names);
    };

    // Scenario B: I am already in the room and someone new walks in
    const handleNewUser = (data: UserData) => {
      setUsers((prev) => {
        if (prev.includes(data.name)) return prev;
        return [...prev, data.name];
      });
    };

    socket.on("current_user_list", handleInitialList);
    socket.on("new_user_joined", handleNewUser);

    return () => {
      socket.off("current_user_list", handleInitialList);
      socket.off("new_user_joined", handleNewUser);
    };
  }, []);

  return { users };
};
