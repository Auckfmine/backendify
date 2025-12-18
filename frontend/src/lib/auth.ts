const TOKEN_KEY = "backendify.tokens";

type TokenBundle = {
  accessToken: string;
  refreshToken: string;
};

function readTokens(): TokenBundle | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TokenBundle;
  } catch {
    return null;
  }
}

export function setTokens(accessToken: string, refreshToken: string) {
  const bundle: TokenBundle = { accessToken, refreshToken };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(bundle));
}

export function getAccessToken(): string | null {
  return readTokens()?.accessToken ?? null;
}

export function getRefreshToken(): string | null {
  return readTokens()?.refreshToken ?? null;
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated() {
  return Boolean(getAccessToken());
}
