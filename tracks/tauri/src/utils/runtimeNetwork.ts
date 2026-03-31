import { invoke } from '@tauri-apps/api/core';
import { getActiveRemoteRuntimeConfig } from './remoteSessionConfig';
import type { RemoteRuntimeConfig } from './remoteSessionConfig';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');
const LOCAL_BACKEND_STARTUP_RETRIES = 40;
const LOCAL_BACKEND_STARTUP_DELAY_MS = 150;

let localRuntimeConfig: RemoteRuntimeConfig | null = null;

const normalizeOptionalBase = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimTrailingSlash(trimmed) : null;
};

const isTauriRuntime = () =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const getWindowOrigin = () => window.location.origin;

const getWindowWebSocketOrigin = () => {
  const url = new URL(window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return trimTrailingSlash(url.toString());
};

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const waitForLocalBackend = async (apiBaseUrl: string) => {
  for (let attempt = 0; attempt < LOCAL_BACKEND_STARTUP_RETRIES; attempt += 1) {
    try {
      const response = await fetch(`${apiBaseUrl}/health`);
      if (response.ok) return;
    } catch {
      // Ignore cold-start failures and retry for a short window.
    }

    await sleep(LOCAL_BACKEND_STARTUP_DELAY_MS);
  }
};

export const initializeRuntimeNetwork = async () => {
  if (!isTauriRuntime() || localRuntimeConfig) return;

  try {
    localRuntimeConfig = await invoke<RemoteRuntimeConfig>('get_local_runtime_config');
    await waitForLocalBackend(localRuntimeConfig.apiBaseUrl);
  } catch (error) {
    console.error('初始化本地运行时网络配置失败:', error);
  }
};

const getLocalRuntimeConfig = () => localRuntimeConfig;

export const getApiBaseUrl = () =>
  getActiveRemoteRuntimeConfig()?.apiBaseUrl ??
  normalizeOptionalBase(import.meta.env.VITE_API_BASE_URL) ??
  (isTauriRuntime() ? getLocalRuntimeConfig()?.apiBaseUrl ?? 'http://127.0.0.1:3000' : '');

export const getWebSocketBaseUrl = () =>
  getActiveRemoteRuntimeConfig()?.wsBaseUrl ??
  normalizeOptionalBase(import.meta.env.VITE_WS_BASE_URL) ??
  (isTauriRuntime() ? getLocalRuntimeConfig()?.wsBaseUrl ?? 'ws://127.0.0.1:3000' : getWindowWebSocketOrigin());

export const buildApiUrl = (path: string) => {
  const base = getApiBaseUrl();
  if (!base) return path;

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};

export const buildWebSocketUrl = (roomId: string) => {
  const base = getWebSocketBaseUrl();
  return `${base}/ws/${roomId}`;
};

export const getFrontendOrigin = () =>
  getActiveRemoteRuntimeConfig()?.frontendOrigin ??
  normalizeOptionalBase(import.meta.env.VITE_FRONTEND_ORIGIN) ??
  (isTauriRuntime() ? getLocalRuntimeConfig()?.frontendOrigin ?? 'tauri://localhost' : getWindowOrigin());
