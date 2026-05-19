import { useState } from "react";
import { socket } from "../socket";
import HomePage from "../pages/HomePage";
import EditorPage from "../pages/EditorPage";

export default function CodeEditor() {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("");
  const [userId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleJoin = (incomingRoomId: string, incomingName: string) => {
    setError(null);
    setIsConnecting(true);
    setRoomId(incomingRoomId);
    setName(incomingName);
    try {
      socket.connect();
      setJoined(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect";
      setError(message);
      setIsConnecting(false);
    }
  };

  if (!joined) {
    return (
      <HomePage onJoin={handleJoin} error={error} isConnecting={isConnecting} />
    );
  }

  return (
    <EditorPage
      roomId={roomId}
      userId={userId}
      name={name}
      onRoomIdChange={setRoomId}
      setError={setError}
      setIsConnecting={setIsConnecting}
      setJoined={setJoined}
    />
  );
}
