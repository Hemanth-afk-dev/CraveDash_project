import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  getTokenExpiration,
  getValidStoredToken,
  SESSION_EXPIRED_EVENT,
  TOKEN_STORAGE_KEY,
} from "../lib/api";
import type { Customer, LoginResponse } from "../types/api";

interface AuthContextValue {
  isAuthenticated: boolean;
  isSigningIn: boolean;
  customer: Customer | null;
  profileError: string;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, displayName: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isCustomer(value: unknown): value is Customer {
  if (!value || typeof value !== "object") return false;
  const customer = value as Record<string, unknown>;
  return (
    Number.isSafeInteger(customer.id) &&
    Number(customer.id) > 0 &&
    typeof customer.email === "string" &&
    typeof customer.displayName === "string"
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(getValidStoredToken);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [profileError, setProfileError] = useState("");

  const acceptAuthentication = useCallback((data: LoginResponse) => {
    const expiresAt = data.token ? getTokenExpiration(data.token) : null;
    if (
      !data.token ||
      typeof data.type !== "string" ||
      data.type.toLocaleLowerCase() !== "bearer" ||
      !expiresAt ||
      expiresAt <= Date.now() ||
      !isCustomer(data.customer)
    ) {
      throw new Error("The authentication response did not include a valid customer session.");
    }
    sessionStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    return data.token;
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setIsSigningIn(true);
      try {
        const { data } = await api.post<LoginResponse>("/auth/login", {
          email,
          password,
        });
        const sessionToken = acceptAuthentication(data);
        try {
          const { data: profile } = await api.get<unknown>("/auth/me");
          if (!isCustomer(profile)) {
            throw new Error("The customer profile response did not match the API contract.");
          }
          setCustomer(profile);
          setProfileError("");
          setToken(sessionToken);
        } catch (error: unknown) {
          sessionStorage.removeItem(TOKEN_STORAGE_KEY);
          setCustomer(null);
          setProfileError("");
          setToken(null);
          throw error;
        }
      } finally {
        setIsSigningIn(false);
      }
    },
    [acceptAuthentication],
  );

  const register = useCallback(
    async (email: string, displayName: string, password: string) => {
      setIsSigningIn(true);
      try {
        await api.post<LoginResponse>("/auth/register", {
          email,
          displayName,
          password,
        });
      } finally {
        setIsSigningIn(false);
      }
    },
    [],
  );

  const signOut = useCallback(() => {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setCustomer(null);
    setProfileError("");
  }, []);

  useEffect(() => {
    const handleExpiredSession = () => {
      setToken(null);
      setCustomer(null);
      setProfileError("");
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpiredSession);
    return () =>
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpiredSession);
  }, []);

  useEffect(() => {
    if (!token || customer) return;
    let active = true;
    api.get<unknown>("/auth/me")
      .then(({ data }) => {
        if (active) {
          if (!isCustomer(data)) {
            throw new Error("The customer profile response did not match the API contract.");
          }
          setCustomer(data);
          setProfileError("");
        }
      })
      .catch((error: unknown) => {
        if (active) setProfileError(
          error instanceof Error ? error.message : "The customer profile could not be loaded.",
        );
      });
    return () => {
      active = false;
    };
  }, [customer, signOut, token]);

  useEffect(() => {
    if (!token) return;
    const expiresAt = getTokenExpiration(token);
    if (!expiresAt) {
      signOut();
      return;
    }
    const timeout = window.setTimeout(
      signOut,
      Math.max(0, expiresAt - Date.now()),
    );
    return () => window.clearTimeout(timeout);
  }, [signOut, token]);

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(token),
      isSigningIn,
      customer,
      profileError,
      signIn,
      register,
      signOut,
    }),
    [customer, isSigningIn, profileError, register, signIn, signOut, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}
