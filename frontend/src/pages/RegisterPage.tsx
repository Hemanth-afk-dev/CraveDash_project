import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, LoaderCircle, UserRoundPlus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../lib/api";

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const { isSigningIn, register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    if (displayName.trim().length < 2) {
      setErrorMessage("Your name must contain at least two non-space characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Your passwords don’t match.");
      return;
    }
    try {
      await register(email.trim(), displayName.trim(), password);
      navigate("/login", {
        replace: true,
        state: { accountCreated: true, registeredEmail: email.trim() },
      });
    } catch (error: unknown) {
      setErrorMessage(getApiErrorMessage(error));
    }
  }

  return (
    <div className="page-shell login-page">
      <div className="login-card">
        <Link to="/" className="back-link"><ArrowLeft size={15} /> Back home</Link>
        <span className="login-icon"><UserRoundPlus size={21} /></span>
        <span className="eyebrow eyebrow-muted">A table for one more</span>
        <h1 className="page-title">Join CraveDash.</h1>
        <p className="section-subtitle">
          Create a customer account to keep your orders connected to you.
        </p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Your name</span>
            <input
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Name on your account"
            />
          </label>
          <label>
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
            />
          </label>
          <label>
            <span>Confirm password</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Enter your password again"
            />
          </label>
          {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
          <button type="submit" className="button-primary w-full" disabled={isSigningIn}>
            {isSigningIn
              ? <><LoaderCircle size={17} className="animate-spin" /> Creating account…</>
              : <>Create account <ArrowRight size={16} /></>}
          </button>
        </form>
        <p className="login-footnote">
          Already have an account? <Link to="/login" className="text-terracotta">Sign in</Link>.
        </p>
      </div>
    </div>
  );
}
