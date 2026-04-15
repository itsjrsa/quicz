"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

let globalSocket: Socket | null = null;

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!globalSocket) {
      globalSocket = io({ path: "/socket.io", transports: ["websocket", "polling"] });
    }
    socketRef.current = globalSocket;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    globalSocket.on("connect", onConnect);
    globalSocket.on("disconnect", onDisconnect);

    if (globalSocket.connected) setConnected(true);

    return () => {
      globalSocket?.off("connect", onConnect);
      globalSocket?.off("disconnect", onDisconnect);
    };
  }, []);

  return { socket: socketRef.current, connected };
}
