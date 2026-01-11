import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { vendorQueryKeys } from "./vendorQueryKeys";
import { managementQueryKeys } from "./managementApiHooks";

// WebSocket URL - should be configured based on environment
const getWsUrl = () => {
  // In production, use wss:// with your domain
  // In development, use ws://localhost:PORT
  const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;
  const wsProtocol = baseUrl.startsWith("https") ? "wss" : "ws";
  const wsHost = baseUrl.replace(/^https?:\/\//, "");
  return `${wsProtocol}://${wsHost}`;
};

type ChangeEvent = {
  type: string;
  data: {
    collection: "vendors" | "products" | "vendor_permissions";
    operationType: "insert" | "update" | "delete" | "replace";
    documentId?: string;
  };
  timestamp: number;
};

/**
 * Hook to enable real-time data synchronization
 * Connects to WebSocket and invalidates queries on data changes
 * 
 * @example
 * ```tsx
 * function App() {
 *   useRealtimeSync(); // Call once at app root
 *   return <RouterProvider router={router} />;
 * }
 * ```
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = getWsUrl();
    console.log("[WS] Connecting to", wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected");
    };

    ws.onmessage = (event) => {
      try {
        const message: ChangeEvent = JSON.parse(event.data);
        console.log("[WS] Received:", message);

        // Invalidate relevant queries based on collection
        switch (message.data.collection) {
          case "vendors":
            queryClient.invalidateQueries({ queryKey: vendorQueryKeys.all });
            queryClient.invalidateQueries({ queryKey: managementQueryKeys.vendors() });
            break;

          case "products":
            queryClient.invalidateQueries({ queryKey: ["products"] });
            break;

          case "vendor_permissions":
            queryClient.invalidateQueries({ queryKey: managementQueryKeys.vendorPermissions() });
            // Also invalidate vendor lists as they depend on permissions
            queryClient.invalidateQueries({ queryKey: vendorQueryKeys.all });
            break;
        }
      } catch (error) {
        console.error("[WS] Failed to parse message:", error);
      }
    };

    ws.onclose = (event) => {
      console.log("[WS] Disconnected, will reconnect in 5s", event.reason);
      wsRef.current = null;

      // Reconnect after delay
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 5000);
    };

    ws.onerror = (error) => {
      console.error("[WS] Error:", error);
    };
  }, [queryClient]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);
}

/**
 * Hook to get WebSocket connection status
 */
export function useWebSocketStatus() {
  // This could be extended to return connection status
  // For now, just return a simple connected state
  return { connected: true };
}
