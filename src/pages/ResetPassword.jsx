import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getAuth, confirmPasswordReset } from "firebase/auth";
import { useToast } from "../context/ToastContext";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get("oobCode");

  const { addToast } = useToast();
  const navigate = useNavigate();
  const auth = getAuth();

  const handleReset = async () => {
    if (!password || password.length < 6) {
      addToast("Password must be at least 6 characters", "error");
      return;
    }

    try {
      setLoading(true);
      await confirmPasswordReset(auth, oobCode, password);
      addToast("Password reset successfully!", "success");
      navigate("/login");
    } catch (err) {
      addToast(err.message || "Reset failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-600/80 px-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl p-8 relative">
        <button
          onClick={() => navigate("/login")}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>

        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 flex items-center justify-center rounded-full bg-blue-100">
            🔒
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center text-gray-900">
          Reset Password
        </h2>

        <p className="text-center text-sm text-gray-500 mt-2 mb-6">
          Enter your new password
        </p>

        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button
          onClick={handleReset}
          disabled={loading}
          className="w-full mt-4 py-3 rounded-xl bg-blue-600 text-white font-semibold
          hover:bg-blue-700 disabled:bg-blue-300"
        >
          {loading ? "Saving..." : "Save Password"}
        </button>

        <div className="text-center mt-6">
          <button
            onClick={() => navigate("/login")}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
             Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
