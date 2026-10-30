import axios from "axios";

export const TOKEN_STORAGE_KEY = "cravedash_access_token";
export const SESSION_EXPIRED_EVENT = "cravedash:session-expired";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  if (config.url === "/auth/login" || config.url === "/auth/register") {
    return config;
  }
  const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  },
);

export function getTokenExpiration(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const normalized = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(normalized)) as { exp?: unknown };
    return typeof decoded.exp === "number" && Number.isFinite(decoded.exp)
      ? decoded.exp * 1000
      : null;
  } catch {
    return null;
  }
}

export function getValidStoredToken(): string | null {
  const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  if (!token) return null;
  const expiresAt = getTokenExpiration(token);
  if (!expiresAt || expiresAt <= Date.now()) {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    return null;
  }
  return token;
}

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    if (error.response?.status === 401) {
      return "Your session has expired or is not valid. Please sign in again.";
    }

    return (
      error.response?.data?.message ||
      error.message ||
      "The request could not be completed."
    );
  }

  if (error instanceof Error) return error.message;
  return "Something unexpected happened. Please try again.";
}
