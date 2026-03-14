import { io } from "socket.io-client";

export const socket = io("http://localhost:3000", {
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
});

// Global error listeners
socket.on("connect_error", (error) => {
  console.error("Socket connection error:", error);
});

socket.on("disconnect", (reason) => {
  console.warn("Socket disconnected. Reason:", reason);
  if (reason === "io server disconnect") {
    // Server disconnected client, attempt reconnection
    socket.connect();
  }
});

socket.on("error", (error) => {
  console.error("Socket error:", error);
});
