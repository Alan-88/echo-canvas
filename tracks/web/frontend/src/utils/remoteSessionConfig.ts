export const CUSTOM_SERVER_KEY = 'whiteboard-custom-server-url';

export const getCustomServerAddress = (): string | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(CUSTOM_SERVER_KEY);
};

export const setCustomServerAddress = (address: string | null) => {
  if (typeof window === 'undefined') return;
  if (!address) {
    window.localStorage.removeItem(CUSTOM_SERVER_KEY);
  } else {
    window.localStorage.setItem(CUSTOM_SERVER_KEY, address);
  }
};
