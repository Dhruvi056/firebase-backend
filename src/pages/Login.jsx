import { useState, useEffect } from "react";
import { useAuthWithToast } from "../hooks/useAuthWithToast";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, resetPassword } = useAuthWithToast();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });
  // Spam protection
  const [lastResetAttempt, setLastResetAttempt] = useState(0);
  const [resetAttempts, setResetAttempts] = useState(0);
  const RESET_ATTEMPT_LIMIT = 3;
  const RESET_COOLDOWN_TIME = 60000; // 1 minute in milliseconds

  useEffect(() => {
    if (loginSuccess && currentUser) {
      setLoading(false);
      toast.success("Welcome back! Logged in successfully.");
      navigate("/", { replace: true });
      setLoginSuccess(false);
    } else if (loginSuccess && !currentUser) {
      setTimeout(() => {
        if (!currentUser) {
          setFormError("Login failed. Please check your credentials.");
          setLoading(false);
          setLoginSuccess(false);
        }
      }, 500);
    }
  }, [currentUser, loginSuccess, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setFieldErrors({ email: "", password: "" });
    setFormError("");
    setLoading(true);

    const nextErrors = { email: "", password: "" };
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!emailRegex.test(email.trim())) {
      nextErrors.email = "Please enter a valid email address.";
    }

    if (!password || password.trim().length === 0) {
      nextErrors.password = "Password is required.";
    }

    if (nextErrors.email || nextErrors.password) {
      setFieldErrors(nextErrors);
      setLoading(false);
      return;
    }

    try {
      await login(email, password);
      toast.success("Welcome back!", { position: 'top-right' });
      setLoginSuccess(true);
    } catch (err) {
      setLoginSuccess(false);
      setLoading(false);
      const code = err.code || "";

      // For auth failures, show only common toast (handled in useAuthWithToast)
      if (
        code === "auth/user-not-found" ||
        code === "auth/invalid-email" ||
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential" ||
        code === "auth/invalid-login-credentials"
      ) {
        setFieldErrors({ email: "", password: "" });
        setFormError("");
        return;
      }

      if (code === "auth/too-many-requests") {
        setFormError("Too many attempts. Please try again later.");
        return;
      }

      setFormError(err.message || "Failed to log in");
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setResetError("");
    setResetSuccess(false);
    setResetLoading(true);

    // Spam protection - rate limiting
    const now = Date.now();
    if (now - lastResetAttempt < RESET_COOLDOWN_TIME && resetAttempts >= RESET_ATTEMPT_LIMIT) {
      const remainingTime = Math.ceil((RESET_COOLDOWN_TIME - (now - lastResetAttempt)) / 1000);
      setResetError(`Too many attempts. Please wait ${remainingTime} seconds before trying again.`);
      setResetLoading(false);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(resetEmail)) {
      setResetError("Please enter a valid email address.");
      setResetLoading(false);
      return;
    }

    // Check for suspicious patterns (basic spam detection)
    const suspiciousPatterns = [
      /noreply/i,
      /no-reply/i,
      /donotreply/i,
      /do-not-reply/i,
      /test@test/i,
      /spam/i
    ];
    
    if (suspiciousPatterns.some(pattern => pattern.test(resetEmail))) {
      setResetError("This email address cannot be used for password reset.");
      setResetLoading(false);
      return;
    }

    try {
      // Update spam protection counters
      setLastResetAttempt(now);
      setResetAttempts(prev => prev + 1);
      
      await resetPassword(resetEmail);
      setResetSuccess(true);
      setResetEmail("");
      // Reset attempt counter on success
      setResetAttempts(0);
      // Auto-close modal after 3 seconds
      setTimeout(() => {
        setShowForgotPassword(false);
        setResetSuccess(false);
      }, 3000);
    } catch (err) {
      // Error is already handled by the hook with toast, but we can show inline error too
      if (err.code === "auth/user-not-found") {
        setResetError("No account found with this email address.");
      } else if (err.code === "auth/invalid-email") {
        setResetError("Invalid email address. Please enter a valid email.");
      } else if (err.code === "auth/too-many-requests") {
        setResetError("Too many requests. Please try again later.");
      } else {
        setResetError(err.message || "Failed to send password reset email. Please try again.");
      }
    } finally {
      setResetLoading(false);
    }
  }
  const [showPassword, setShowPassword] = useState(false);

  // Helper component to render Lucide icons safely
  const LucideIcon = ({ name, className = "", style = {} }) => {
    useEffect(() => {
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }, [name]);
    
    return (
      <span 
        className={`d-inline-flex align-items-center justify-content-center ${className}`}
        style={style}
        dangerouslySetInnerHTML={{ __html: `<i data-lucide="${name}"></i>` }}
      />
    );
  };

  return (
    <div className="main-wrapper">
      <div className="page-wrapper full-page">
        <div className="page-content container-xxl d-flex align-items-center justify-content-center">
          <div className="row w-100 mx-0 auth-page">
            <div className="col-md-10 col-lg-8 col-xl-6 mx-auto">
              <div className="card shadow-sm border-0 overflow-hidden">
                <div className="row">
                  <div className="col-md-12 ps-md-0">
                    <div className="auth-form-wrapper px-4 py-5">
                      <div className="nobleui-logo d-block mb-2 text-center">Cs<span>Formly</span></div>
                      <h5 className="text-secondary fw-normal mb-4 text-center">Welcome back! Log in to your account.</h5>
                      
                      {formError && (
                        <div className="alert alert-danger py-2 d-flex align-items-center" role="alert">
                          <LucideIcon name="alert-circle" className="icon-sm me-2" />
                          <span className="fs-13px">{formError}</span>
                        </div>
                      )}

                      <form className="forms-sample" onSubmit={handleSubmit} noValidate>
                        <div className="mb-3">
                          <label className="form-label">Email address</label>
                          <input 
                            type="email" 
                            className={`form-control ${fieldErrors.email ? "is-invalid" : ""}`}
                            placeholder="Email"
                            value={email}
                            onChange={(e) => {
                              setEmail(e.target.value);
                              setFieldErrors((prev) => ({ ...prev, email: "" }));
                            }}
                          />
                          {fieldErrors.email && <div className="invalid-feedback d-block">{fieldErrors.email}</div>}
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Password</label>
                          <div className={`input-group ${fieldErrors.password ? "is-invalid" : ""}`}>
                            <input 
                              type={showPassword ? "text" : "password"} 
                              className={`form-control ${fieldErrors.password ? "is-invalid" : ""}`}
                              autoComplete="current-password" 
                              placeholder="Password"
                              value={password}
                              onChange={(e) => {
                                setPassword(e.target.value);
                                setFieldErrors((prev) => ({ ...prev, password: "" }));
                              }}
                              style={{
                                borderRight: "none",
                                backgroundImage: fieldErrors.password ? "none" : undefined,
                                paddingRight: fieldErrors.password ? "0.75rem" : undefined,
                              }}
                            />
                            <button 
                              className={`btn btn-outline-secondary px-3 ${fieldErrors.password ? "border-danger text-danger" : ""}`} 
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              style={{ 
                                borderLeft: 'none',
                                backgroundColor: 'transparent',
                                borderTopRightRadius: '4px',
                                borderBottomRightRadius: '4px',
                                borderColor: 'var(--bs-border-color)'
                              }}
                            >
                              <LucideIcon name={showPassword ? "eye-off" : "eye"} style={{ width: '16px', height: '16px' }} />
                            </button>
                          </div>
                          {fieldErrors.password && <div className="invalid-feedback d-block">{fieldErrors.password}</div>}
                        </div>
                        <div className="mb-3 d-flex justify-content-between align-items-center">
                          <div className="form-check">
                            <input type="checkbox" className="form-check-input" id="authCheck" />
                            <label className="form-check-label ms-1" htmlFor="authCheck">
                              Remember me
                            </label>
                          </div>
                          <button 
                            type="button" 
                            className="btn btn-link p-0 text-decoration-none fs-13px"
                            onClick={() => {
                              setShowForgotPassword(true);
                              setResetEmail(email);
                            }}
                          >
                            Forgot password?
                          </button>
                        </div>
                        <div className="text-center pt-2">
                          <button 
                            type="submit" 
                            className="btn btn-primary d-block w-100 text-white py-2 mb-3 shadow-sm fw-bold"
                            disabled={loading}
                          >
                            {loading ? "Logging in..." : "Login"}
                          </button>
                        </div>
                        <p className="mt-3 text-secondary text-center fs-14px">
                          Don't have an account? <Link to="/signup" className="text-primary fw-bold text-decoration-none ms-1">Sign up</Link>
                        </p>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Forgot Password Modal (Restructured for Bootstrap) */}
      {showForgotPassword && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header border-0 pb-0">
                <button 
                  type="button" 
                  className="btn-close" 
                  aria-label="Close" 
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetEmail("");
                    setResetError("");
                    setResetSuccess(false);
                    setResetAttempts(0);
                  }}
                ></button>
              </div>
              <div className="modal-body p-4 text-center">
                <div className="mb-4 d-inline-block p-3 bg-primary-subtle rounded-circle">
                  <i className="text-primary fs-1" data-lucide="unlock"></i>
                </div>
                <h4 className="fw-bold mb-2">Reset Password</h4>
                <p className="text-secondary mb-4">Enter your email and we'll send you a link to reset your password</p>

                {resetSuccess && (
                  <div className="alert alert-success text-start" role="alert">
                    <h6 className="alert-heading fw-bold">Email Sent!</h6>
                    Check your inbox for password reset instructions.
                  </div>
                )}

                {!resetSuccess && (
                  <form onSubmit={handleForgotPassword}>
                    <div className="mb-3 text-start">
                      <label className="form-label fw-semibold">Email Address</label>
                      <input 
                        type="email" 
                        required
                        className={`form-control ${resetError ? 'is-invalid' : ''}`}
                        placeholder="you@example.com"
                        value={resetEmail}
                        onChange={(e) => {
                          setResetEmail(e.target.value);
                          setResetError("");
                        }}
                      />
                      {resetError && <div className="invalid-feedback">{resetError}</div>}
                    </div>
                    <button 
                      type="submit" 
                      className="btn btn-primary w-100 py-2 mb-3 shadow-sm"
                      disabled={resetLoading || (resetAttempts >= RESET_ATTEMPT_LIMIT && Date.now() - lastResetAttempt < RESET_COOLDOWN_TIME)}
                    >
                      {resetLoading ? "Sending Reset Link..." : "Send Reset Link"}
                    </button>
                  </form>
                )}
                
                <button 
                  type="button" 
                  className="btn btn-link text-secondary text-decoration-none"
                  onClick={() => setShowForgotPassword(false)}
                >
                  ← Back to Login
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

