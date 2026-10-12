import { LoginForm } from "./login-form";
export default function Login() {
  return <main className="login-screen"><div className="login-card">
    <div className="brand-mark">SHL<span>.</span></div>
    <p className="eyebrow">PRIVATE WORKSPACE</p><h1>Welcome back.</h1>
    <p className="muted">Sign in to manage your operations.</p><LoginForm />
  </div></main>;
}

