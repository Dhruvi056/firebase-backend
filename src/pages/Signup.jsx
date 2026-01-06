import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();

    if (password !== confirmPassword) {
      return setError("Passwords do not match");
    }

    if (password.length < 6) {
      return setError("Password must be at least 6 characters long");
    }

    try {
      setError("");
      setLoading(true);
      await signup(email, password);
      navigate("/");
    } catch (err) {
      console.error("Signup error details:", {
        code: err.code,
        message: err.message,
        error: err,
      });
      
      let errorMessage = "Failed to create an account";
      
      if (err.code === "auth/email-already-in-use") {
        errorMessage = "This email is already registered. Please use a different email or log in.";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Invalid email address. Please enter a valid email.";
      } else if (err.code === "auth/weak-password") {
        errorMessage = "Password is too weak. Please use a stronger password (at least 6 characters).";
      } else if (err.code === "auth/operation-not-allowed") {
        errorMessage = "Email/Password authentication is not enabled. Please enable it in Firebase Console under Authentication > Sign-in method.";
      } else if (err.code === "auth/configuration-not-found") {
        errorMessage = "Firebase Authentication is not configured. Please enable it in Firebase Console.";
      } else if (err.code === "auth/invalid-api-key") {
        errorMessage = "Invalid API key. Please check your .env file and Firebase project settings.";
      } else if (err.code === "auth/network-request-failed") {
        errorMessage = "Network error. Please check your internet connection.";
      } else if (err.message) {
        errorMessage = `${err.message}${err.code ? ` (Code: ${err.code})` : ""}`;
      } else {
        errorMessage = `Error: ${err.code || "Unknown error"}. Please check the browser console for details.`;
      }
      
      setError(errorMessage);
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7] flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl p-8 space-y-6">
        <h1 className="text-3xl font-bold text-gray-900 text-center">Sign Up</h1>

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-800 
              placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Confirm your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 rounded-2xl bg-blue-600 text-white text-sm font-semibold 
            hover:bg-blue-700 disabled:bg-blue-300 transition"
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <div className="text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
            Log In
          </Link>
        </div>
      </div>
    </div>
  );
}

