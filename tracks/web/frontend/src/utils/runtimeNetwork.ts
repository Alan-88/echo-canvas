import { getCustomServerAddress } from './remoteSessionConfig';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const normalizeOptionalBase = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimTrailingSlash(trimmed) : null;
};

const getWindowOrigin = () => window.location.origin;

const getWindowWebSocketOrigin = () => {
  const url = new URL(window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return trimTrailingSlash(url.toString());
};

const isLocalLikeHost = (host: string) =>
  host === 'localhost' ||
  host === '127.0.0.1' ||
  host === '0.0.0.0' ||
  host.startsWith('192.168.') ||
  host.startsWith('10.') ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

const normalizeCustomServer = (address: string) => {
  const normalized = address.trim().replace(/\s+/g, '');
  const hostCandidate = normalized.split('/')[0].split(':')[0];
  const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(normalized)
    ? normalized
    : `${isLocalLikeHost(hostCandidate) ? 'http' : 'https'}://${normalized}`;
  const url = new URL(withScheme);
  return trimTrailingSlash(url.toString());
};

export const getApiBaseUrl = () => {
  const customServer = getCustomServerAddress();
  if (customServer) return normalizeCustomServer(customServer);
  return normalizeOptionalBase(import.meta.env.VITE_API_BASE_URL) ?? '';
};

export const getWebSocketBaseUrl = () => {
  const customServer = getCustomServerAddress();
  if (customServer) {
    const url = new URL(normalizeCustomServer(customServer));
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return trimTrailingSlash(url.toString());
  }
  return normalizeOptionalBase(import.meta.env.VITE_WS_BASE_URL) ?? getWindowWebSocketOrigin();
};

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
  normalizeOptionalBase(import.meta.env.VITE_FRONTEND_ORIGIN) ?? getWindowOrigin();
