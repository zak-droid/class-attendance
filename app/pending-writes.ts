let writes = 0;
export const hasPendingNetworkWrites = () => writes > 0;

// Includes course/roster/schedule saves and authentication requests, even if a
// dialog is closed before its request completes. Reads remain ordinary fetches.
export const fetchWithWriteTracking: typeof fetch = async (input, init) => {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return fetch(input, init);
  writes += 1;
  try {
    const response = await fetch(input, init);
    // Keep the guard until the complete response arrives, not just its headers.
    await response.clone().arrayBuffer();
    return response;
  } finally { writes -= 1; }
};
