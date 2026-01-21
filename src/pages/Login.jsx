import { useState, useEffect } from "react";
import { useAuthWithToast } from "../hooks/useAuthWithToast";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
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
  // Spam protection
  const [lastResetAttempt, setLastResetAttempt] = useState(0);
  const [resetAttempts, setResetAttempts] = useState(0);
  const RESET_ATTEMPT_LIMIT = 3;
  const RESET_COOLDOWN_TIME = 60000; // 1 minute in milliseconds

  useEffect(() => {
    if (loginSuccess && currentUser) {
      setLoading(false);
      navigate("/", { replace: true });
      setLoginSuccess(false);
    } else if (loginSuccess && !currentUser) {
      setTimeout(() => {
        if (!currentUser) {
          setError("Login failed. Please check your credentials.");
          setLoading(false);
          setLoginSuccess(false);
        }
      }, 500);
    }
  }, [currentUser, loginSuccess, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setLoading(true);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      setLoading(false);
      return;
    }

    if (!password || password.trim().length === 0) {
      setError("Password is required.");
      setLoading(false);
      return;
    }

    try {
      await login(email, password);
      
      setLoginSuccess(true);
    } catch (err) {
      // Login failed - do NOT navigate to dashboard
      setLoginSuccess(false);
      setLoading(false);
      let errorMessage = "Failed to log in";
      
      if (err.code === "auth/user-not-found") {
        errorMessage = "No account found with this email. Please sign up first.";
      } else if (err.code === "auth/wrong-password") {
        errorMessage = "Incorrect password. Please try again.";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Invalid email address. Please enter a valid email.";
      } else if (err.code === "auth/invalid-credential") {
        errorMessage = "Invalid email or password. Please check your credentials.";
      } else if (err.code === "auth/operation-not-allowed") {
        errorMessage = "Email/Password authentication is not enabled. Please enable it in Firebase Console.";
      } else if (err.code === "auth/configuration-not-found") {
        errorMessage = "Firebase Authentication is not configured. Please enable it in Firebase Console.";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      // Stay on login page - do NOT navigate
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

  return (
    <div className="min-h-screen bg-[#f4f5f7] flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl p-8 space-y-6">
        <h1 className="text-3xl font-bold text-gray-900 text-center">Log in</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-800 
              placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Password
              </label>
             
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-800 
              placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your password"
            />
          </div>
           <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(true);
                  setResetEmail(email); // Pre-fill with login email if available
                }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Forgot Password?
              </button>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 rounded-2xl bg-blue-600 text-white text-sm font-semibold 
            hover:bg-blue-700 disabled:bg-blue-300 transition"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="text-center text-sm text-gray-600">
          Don't have an account?{" "}
          <Link to="/signup" className="text-blue-600 hover:text-blue-700 font-semibold">
            Sign Up
          </Link>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8 space-y-6 relative transform transition-all duration-300 scale-100">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowForgotPassword(false);
                setResetEmail("");
                setResetError("");
                setResetSuccess(false);
                setResetAttempts(0);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            {/* Header */}
            <div className="text-center space-y-2">
              <div className="mx-auto bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Reset Password</h2>
              <p className="text-gray-600 text-base">
                Enter your email and we'll send you a link to reset your password
              </p>
            </div>

            {/* Success Message */}
            {resetSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 animate-slideDown">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-green-500"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-green-800 font-medium">Email Sent!</h3>
                    <p className="text-green-700 text-sm mt-1">
                      Check your inbox for password reset instructions. The link will expire in 1 hour.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Form */}
            {!resetSuccess && (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => {
                        setResetEmail(e.target.value);
                        setResetError("");
                      }}
                      className={`w-full rounded-xl border px-4 py-3 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${resetError ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-gray-400'}`}
                      placeholder="you@example.com"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  </div>
                  {resetError && (
                    <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {resetError}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={resetLoading || (resetAttempts >= RESET_ATTEMPT_LIMIT && Date.now() - lastResetAttempt < RESET_COOLDOWN_TIME)}
                  className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold 
                  hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  {resetLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Sending Reset Link...
                    </div>
                  ) : resetAttempts >= RESET_ATTEMPT_LIMIT && Date.now() - lastResetAttempt < RESET_COOLDOWN_TIME ? (
                    <div className="flex items-center justify-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Please Wait...
                    </div>
                  ) : (
                    "Send Reset Link"
                  )}
                </button>
              </form>
            )}

            {/* Footer */}
            <div className="pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetEmail("");
                  setResetError("");
                  setResetSuccess(false);
                  setResetAttempts(0);
                }}
                className="w-full py-2.5 text-center text-sm text-gray-600 hover:text-gray-800 font-medium transition-colors rounded-lg hover:bg-gray-50"
              >
                ← Back to Login
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

