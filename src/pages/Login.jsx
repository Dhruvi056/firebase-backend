import { useState, useEffect } from "react";
import { useAuthWithToast } from "../hooks/useAuthWithToast";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuthWithToast();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loginSuccess, setLoginSuccess] = useState(false);

  // Navigate to dashboard only when user is authenticated AFTER manual login
  useEffect(() => {
    // Only navigate if loginSuccess flag is set (meaning user just logged in)
    // This prevents auto-navigation from cached sessions
    if (loginSuccess && currentUser) {
      setLoading(false);
      navigate("/", { replace: true });
      setLoginSuccess(false);
    } else if (loginSuccess && !currentUser) {
      // If login was marked successful but user is not authenticated, there was an issue
      setTimeout(() => {
        if (!currentUser) {
          setError("Login failed. Please check your credentials.");
          setLoading(false);
          setLoginSuccess(false);
        }
      }, 500);
    }
    // Do NOT navigate if currentUser exists but loginSuccess is false
    // This means it's a cached session, not a fresh login
  }, [currentUser, loginSuccess, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();

    // Clear previous errors
    setError("");
    setLoading(true);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      setLoading(false);
      return;
    }

    // Validate password is not empty
    if (!password || password.trim().length === 0) {
      setError("Password is required.");
      setLoading(false);
      return;
    }

    try {
      // Attempt login - this will throw error if credentials are wrong
      await login(email, password);
      
      // Mark login as successful - useEffect will handle navigation when currentUser is set
      setLoginSuccess(true);
      // Loading will be set to false in useEffect when navigation happens
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
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
    </div>
  );
}

