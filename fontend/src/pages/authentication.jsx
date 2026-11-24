import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import Logo from "../components/Logo";
import ThemeSwitcher from "../components/ThemeSwitcher";
import { useAuth } from "../contexts/AuthContext";
import { errorMessage } from "../api/client";
import "../App.css";

const safeNext = (next) => (next && next.startsWith("/") && !next.startsWith("//") ? next : "/home");

export default function Authentication() {
    const { handleLogin, handleRegister, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const next = safeNext(params.get("next"));

    const [mode, setMode] = useState(params.get("mode") === "signup" ? "signup" : "signin");
    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);
    const [touched, setTouched] = useState({});

    useEffect(() => {
        setError("");
        setTouched({});
    }, [mode]);

    if (isAuthenticated && !loading) return <Navigate to={next} replace />;

    const isSignup = mode === "signup";
    const errors = {
        name: isSignup && !name.trim() ? "Please enter your name" : "",
        username: !username.trim()
            ? "Please enter a username"
            : isSignup && !/^[a-zA-Z0-9_.-]{3,30}$/.test(username.trim())
            ? "3-30 characters: letters, numbers, . _ or -"
            : "",
        password: !password
            ? "Please enter a password"
            : isSignup && password.length < 8
            ? "Use at least 8 characters"
            : "",
    };
    const hasErrors = Object.values(errors).some(Boolean);

    const submit = async (e) => {
        e.preventDefault();
        setTouched({ name: true, username: true, password: true });
        if (hasErrors) return;

        setLoading(true);
        setError("");
        setSuccess("");
        try {
            if (isSignup) {
                const msg = await handleRegister(name.trim(), username.trim(), password);
                setSuccess(msg || "Account created! Please sign in.");
                setPassword("");
                setMode("signin");
            } else {
                await handleLogin(username.trim(), password);
                navigate(next, { replace: true });
            }
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const fieldError = (key) => touched[key] && errors[key];

    return (
        <div className="auth-page">
            <aside className="auth-aside">
                <Logo />
                <div className="auth-aside-copy">
                    <h2>Connect with anyone, anywhere.</h2>
                    <ul>
                        <li><CheckCircleOutlineIcon /> HD video calls across any network</li>
                        <li><CheckCircleOutlineIcon /> Screen sharing, chat & reactions</li>
                        <li><CheckCircleOutlineIcon /> Your meeting history in one place</li>
                    </ul>
                </div>
                <div className="auth-aside-foot">Free forever for personal use.</div>
            </aside>

            <main className="auth-main">
                <div className="auth-theme"><ThemeSwitcher /></div>
                <div className="auth-card">
                    <div className="auth-mobile-logo"><Logo /></div>
                    <h1>{isSignup ? "Create your account" : "Welcome back"}</h1>
                    <p className="auth-sub">
                        {isSignup ? "Start hosting meetings in seconds." : "Sign in to start or join meetings."}
                    </p>

                    <div className="segmented" role="tablist">
                        <button role="tab" aria-selected={!isSignup} className={!isSignup ? "active" : ""} onClick={() => setMode("signin")}>
                            Sign in
                        </button>
                        <button role="tab" aria-selected={isSignup} className={isSignup ? "active" : ""} onClick={() => setMode("signup")}>
                            Sign up
                        </button>
                    </div>

                    {success && <div className="alert alert-success">{success}</div>}
                    {error && <div className="alert alert-error">{error}</div>}

                    <form onSubmit={submit} noValidate>
                        {isSignup && (
                            <div className="field">
                                <label htmlFor="name">Full name</label>
                                <input
                                    id="name"
                                    className={`input ${fieldError("name") ? "has-error" : ""}`}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                                    autoComplete="name"
                                    autoFocus
                                    maxLength={60}
                                />
                                {fieldError("name") && <span className="field-error">{errors.name}</span>}
                            </div>
                        )}

                        <div className="field">
                            <label htmlFor="username">Username</label>
                            <input
                                id="username"
                                className={`input ${fieldError("username") ? "has-error" : ""}`}
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                onBlur={() => setTouched((t) => ({ ...t, username: true }))}
                                autoComplete="username"
                                autoCapitalize="none"
                                autoFocus={!isSignup}
                                maxLength={30}
                            />
                            {fieldError("username") && <span className="field-error">{errors.username}</span>}
                        </div>

                        <div className="field">
                            <label htmlFor="password">Password</label>
                            <div className={`input-icon ${fieldError("password") ? "has-error" : ""}`}>
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                                    autoComplete={isSignup ? "new-password" : "current-password"}
                                    maxLength={128}
                                />
                                <button
                                    type="button"
                                    className="icon-btn"
                                    style={{ width: 32, height: 32 }}
                                    onClick={() => setShowPassword((s) => !s)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
                                </button>
                            </div>
                            {fieldError("password") && <span className="field-error">{errors.password}</span>}
                        </div>

                        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
                            {loading && <span className="spinner spinner-sm" />}
                            {isSignup ? "Create account" : "Sign in"}
                        </button>
                    </form>

                    <p className="auth-switch">
                        {isSignup ? "Already have an account?" : "New to MeetHive?"}{" "}
                        <button onClick={() => setMode(isSignup ? "signin" : "signup")}>
                            {isSignup ? "Sign in" : "Create an account"}
                        </button>
                    </p>
                    <p className="auth-switch">
                        Just joining a call? <button onClick={() => navigate("/")}>Join as guest</button>
                    </p>
                </div>
            </main>
        </div>
    );
}
