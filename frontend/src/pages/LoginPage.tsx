import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, LoaderCircle, LockKeyhole } from "lucide-react";
import axios from "axios";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../lib/api";

export default function LoginPage() {
  const location = useLocation();
  const registrationState = location.state as
    | { accountCreated?: unknown; registeredEmail?: unknown }
    | null;
  const accountCreated = registrationState?.accountCreated === true;
  const [email, setEmail] = useState(
    typeof registrationState?.registeredEmail === "string"
      ? registrationState.registeredEmail
      : "",
  );
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const { isAuthenticated, isSigningIn, signIn } = useAuth();
  const navigate = useNavigate();

  const redirectTo =
    (location.state as { from?: string } | null)?.from ?? "/restaurants";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    try {
      await signIn(email.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (error: unknown) {
      const message = axios.isAxiosError(error) && error.response?.status === 401
        ? "Those sign-in details don’t look right. Please try again."
        : getApiErrorMessage(error);
      setErrorMessage(message);
    }
  }

  return (
    <div className="page-shell login-page">
      <div className="login-card">
        <Link to="/" className="back-link"><ArrowLeft size={15} /> Back home</Link>
        <span className="login-icon"><LockKeyhole size={21} /></span>
        <span className="eyebrow eyebrow-muted">Your neighborhood is waiting</span>
        <h1 className="page-title">{isAuthenticated ? "Let’s get you back in." : "Come on in."}</h1>
        <p className="section-subtitle">
          {isAuthenticated
            ? "Your saved session may have expired. Sign in again to continue."
            : "Sign in to browse restaurants, place orders, and see your order history."}
        </p>
        {accountCreated && (
          <p className="cart-notice mt-5" role="status">
            Your account was created. Sign in with your new credentials to continue.
          </p>
        )}
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
            />
          </label>
          {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
          <button type="submit" className="button-primary w-full" disabled={isSigningIn}>
            {isSigningIn ? <><LoaderCircle size={17} className="animate-spin" /> Signing in…</> : <>Sign in <ArrowRight size={16} /></>}
          </button>
        </form>
        <p className="login-footnote">
          New to CraveDash? <Link to="/register" className="text-terracotta">Create an account</Link>.
        </p>
      </div>
    </div>
  );
}
