import type { Room, UserState } from "../types/globalTypes.js";

export const rooms = new Map<string, Room>();
export const users = new Map<string, UserState>();
export const socketToUser = new Map<string, string>(); // socketId → userId
export const socketToRoom = new Map<string, string>(); // socketId → roomId
