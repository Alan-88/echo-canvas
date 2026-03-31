const ACTIVE_REMOTE_RUNTIME_KEY = 'whiteboard-active-remote-runtime';
const PREFERRED_REMOTE_ADDRESS_KEY = 'whiteboard-preferred-remote-address';

export interface RemoteRuntimeConfig {
  serverAddress: string;
  apiBaseUrl: string;
  wsBaseUrl: string;
  frontendOrigin: string;
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const isLocalLikeHost = (host: string) =>
  host === 'localhost' ||
  host === '127.0.0.1' ||
  host === '0.0.0.0' ||
  host.startsWith('192.168.') ||
  host.startsWith('10.') ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

const normalizeAddressInput = (value: string) => value.trim().replace(/\s+/g, '');

export const normalizeRemoteServerAddress = (value: string): string => {
  const normalized = normalizeAddressInput(value);
  if (!normalized) {
    throw new Error('请输入服务器地址');
  }

  const hostCandidate = normalized.split('/')[0].split(':')[0];
  const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(normalized)
    ? normalized
    : `${isLocalLikeHost(hostCandidate) ? 'http' : 'https'}://${normalized}`;

  const url = new URL(withScheme);
  return trimTrailingSlash(url.toString());
};

export const buildRemoteRuntimeConfig = (serverAddress: string): RemoteRuntimeConfig => {
  const normalizedAddress = normalizeRemoteServerAddress(serverAddress);
  const apiUrl = new URL(normalizedAddress);
  const wsUrl = new URL(normalizedAddress);
  wsUrl.protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';

  return {
    serverAddress: normalizedAddress,
    apiBaseUrl: trimTrailingSlash(apiUrl.toString()),
    wsBaseUrl: trimTrailingSlash(wsUrl.toString()),
    frontendOrigin: trimTrailingSlash(apiUrl.origin),
  };
};

export const getPreferredRemoteServerAddress = () =>
  typeof window === 'undefined'
    ? ''
    : window.localStorage.getItem(PREFERRED_REMOTE_ADDRESS_KEY) || '';

export const setPreferredRemoteServerAddress = (serverAddress: string) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PREFERRED_REMOTE_ADDRESS_KEY, serverAddress);
};

export const getActiveRemoteRuntimeConfig = (): RemoteRuntimeConfig | null => {
  if (typeof window === 'undefined') return null;

  const raw = window.sessionStorage.getItem(ACTIVE_REMOTE_RUNTIME_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as RemoteRuntimeConfig;
  } catch {
    window.sessionStorage.removeItem(ACTIVE_REMOTE_RUNTIME_KEY);
    return null;
  }
};

export const setActiveRemoteRuntimeConfig = (config: RemoteRuntimeConfig) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(ACTIVE_REMOTE_RUNTIME_KEY, JSON.stringify(config));
};

export const clearActiveRemoteRuntimeConfig = () => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(ACTIVE_REMOTE_RUNTIME_KEY);
};
