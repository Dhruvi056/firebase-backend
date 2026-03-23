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
    <div className="main-wrapper">
      <div className="page-wrapper full-page">
        <div className="page-content container-xxl d-flex align-items-center justify-content-center">

          <div className="row w-100 mx-0 auth-page">
            <div className="col-md-10 col-lg-8 col-xl-6 mx-auto">
              <div className="card shadow-sm border-0">
                <div className="row">
                  <div className="col-md-4 pe-md-0">
                    <div className="auth-side-wrapper" style={{ backgroundImage: "url(/assets/images/photos/img6.jpg)" }}>
                    </div>
                  </div>
                  <div className="col-md-8 ps-md-0">
                    <div className="auth-form-wrapper px-4 py-5 text-center">
                      <div className="nobleui-logo d-block mb-2 text-start">Headless<span>Form</span></div>
                      <div className="mb-4 d-inline-block p-3 bg-primary-subtle rounded-circle mx-auto">
                        <i className="text-primary fs-1" data-lucide="lock"></i>
                      </div>
                      <h4 className="fw-bold mb-2">Reset Password</h4>
                      <p className="text-secondary mb-4">Enter your new password below.</p>

                      <div className="mb-3 text-start">
                        <label className="form-label fw-semibold">New Password</label>
                        <input 
                          type="password" 
                          className="form-control" 
                          placeholder="At least 6 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>
                      
                      <button 
                        onClick={handleReset}
                        disabled={loading}
                        className="btn btn-primary w-100 py-2 mb-3 shadow-sm"
                      >
                        {loading ? "Saving..." : "Save Password"}
                      </button>
                      
                      <button 
                        type="button" 
                        className="btn btn-link text-secondary text-decoration-none"
                        onClick={() => navigate("/login")}
                      >
                        ← Back to Login
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
