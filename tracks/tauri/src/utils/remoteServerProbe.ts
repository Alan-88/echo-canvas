const PROBE_TIMEOUT_MS = 4_000;

const withTimeout = async (input: RequestInfo | URL, init?: RequestInit) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export const probeRemoteServer = async (apiBaseUrl: string, roomId: string) => {
  const startedAt = performance.now();
  const encodedRoomId = encodeURIComponent(roomId.trim());
  const response = await withTimeout(`${apiBaseUrl}/api/room/${encodedRoomId}/exists`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`服务器探测失败: HTTP ${response.status}`);
  }

  return Math.max(1, Math.round(performance.now() - startedAt));
};
