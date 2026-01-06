import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setError("");
      setLoading(true);
      await login(email, password);
      navigate("/");
    } catch (err) {
      let errorMessage = "Failed to log in";
      
      if (err.code === "auth/user-not-found") {
        errorMessage = "No account found with this email. Please sign up first.";
      } else if (err.code === "auth/wrong-password") {
        errorMessage = "Incorrect password. Please try again.";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Invalid email address. Please enter a valid email.";
      } else if (err.code === "auth/operation-not-allowed") {
        errorMessage = "Email/Password authentication is not enabled. Please enable it in Firebase Console.";
      } else if (err.code === "auth/configuration-not-found") {
        errorMessage = "Firebase Authentication is not configured. Please enable it in Firebase Console.";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    }

    setLoading(false);
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

