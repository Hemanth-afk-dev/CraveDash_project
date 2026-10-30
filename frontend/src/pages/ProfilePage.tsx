import { Link } from "react-router-dom";
import { ArrowRight, LoaderCircle, UserRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const { customer, profileError } = useAuth();

  return (
    <div className="page-shell page-top-space">
      <section className="login-card">
        <span className="login-icon"><UserRound size={21} /></span>
        <span className="eyebrow eyebrow-muted">Your CraveDash account</span>
        <h1 className="page-title">My profile.</h1>
        {profileError ? (
          <p className="form-error" role="alert">{profileError}</p>
        ) : !customer ? (
          <p className="section-subtitle flex items-center gap-2">
            <LoaderCircle size={16} className="animate-spin" /> Loading your profile…
          </p>
        ) : (
          <dl className="mt-6 grid gap-4 text-sm">
            <div>
              <dt className="text-stone-500">Name</dt>
              <dd className="mt-1 font-semibold">{customer.displayName}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Email</dt>
              <dd className="mt-1 font-semibold">{customer.email}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Customer number</dt>
              <dd className="mt-1 font-semibold">{customer.id}</dd>
            </div>
          </dl>
        )}
        <Link to="/orders" className="button-primary mt-7">
          View my orders <ArrowRight size={16} />
        </Link>
      </section>
    </div>
  );
}
