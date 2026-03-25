import { useState, useEffect } from "react";
import { useAuthWithToast } from "../hooks/useAuthWithToast";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup } = useAuthWithToast();
  const navigate = useNavigate();

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

  const [fieldErrors, setFieldErrors] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    terms: "",
  });
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setFieldErrors({
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      terms: "",
    });
    setFormError("");

    const newFieldErrors = {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      terms: "",
    };
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!fullName.trim()) {
      newFieldErrors.fullName = "Full name is required.";
    }

    if (!email.trim()) {
      newFieldErrors.email = "Email is required.";
    } else if (!emailRegex.test(email.trim())) {
      newFieldErrors.email = "Please enter a valid email address.";
    }

    if (!password) {
      newFieldErrors.password = "Password is required.";
    } else if (password.length < 6) {
      newFieldErrors.password = "Password must be at least 6 characters long.";
    }

    if (!confirmPassword) {
      newFieldErrors.confirmPassword = "Confirm password is required.";
    } else if (password !== confirmPassword) {
      newFieldErrors.confirmPassword = "Password and confirm password must match.";
    }

    if (!agreeToTerms) {
      newFieldErrors.terms = "Please accept terms and conditions.";
    }

    const hasFieldErrors = Object.values(newFieldErrors).some(Boolean);
    if (hasFieldErrors) {
      setFieldErrors(newFieldErrors);
      return;
    }

    try {
      setLoading(true);
      await signup(email, password, fullName);
      toast.success("Account created successfully! Welcome!", {
        position: 'top-right',
        duration: 4000
      });
      navigate("/");
    } catch (err) {
      console.error("Signup error details:", err);
      if (err.code === "auth/email-already-in-use") {
        setFieldErrors((prev) => ({
          ...prev,
          email: "This email is already in use. Please use another email.",
        }));
      } else if (err.code === "auth/invalid-email") {
        setFieldErrors((prev) => ({
          ...prev,
          email: "Please enter a valid email address.",
        }));
      } else if (err.code === "auth/weak-password") {
        setFieldErrors((prev) => ({
          ...prev,
          password: "Password is too weak. Use at least 6 characters.",
        }));
      } else {
        setFormError(err.message || "Failed to create an account");
      }
    } finally {
      setLoading(false);
    }
  }

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
                      <div className="nobleui-logo d-block mb-2 text-center">CS <span>Formly</span></div>
                      <h5 className="text-secondary fw-normal mb-4 text-center">Create a free account.</h5>
                      
                      {formError && (
                        <div className="alert alert-danger py-2 d-flex align-items-center" role="alert">
                          <LucideIcon name="alert-circle" className="icon-sm me-2" />
                          <span className="fs-13px">{formError}</span>
                        </div>
                      )}

                      <form className="forms-sample" onSubmit={handleSubmit} noValidate>
                        <div className="mb-3">
                          <label className="form-label">Full Name</label>
                          <input 
                            type="text" 
                            className={`form-control ${fieldErrors.fullName ? "is-invalid" : ""}`}
                            placeholder="Full Name"
                            value={fullName}
                            onChange={(e) => {
                              setFullName(e.target.value);
                              setFieldErrors((prev) => ({ ...prev, fullName: "" }));
                            }}
                          />
                          {fieldErrors.fullName && <div className="invalid-feedback d-block">{fieldErrors.fullName}</div>}
                        </div>
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
                          <div className="input-group">
                            <input 
                              type={showPassword ? "text" : "password"} 
                              className={`form-control ${fieldErrors.password ? "is-invalid" : ""}`}
                              autoComplete="new-password" 
                              placeholder="Password"
                              value={password}
                              onChange={(e) => {
                                setPassword(e.target.value);
                                setFieldErrors((prev) => ({ ...prev, password: "" }));
                              }}
                              style={{ borderRight: 'none' }}
                            />
                            <button 
                              className="btn btn-outline-secondary px-3" 
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
                        <div className="mb-3">
                          <label className="form-label">Confirm Password</label>
                          <div className="input-group">
                            <input 
                              type={showConfirmPassword ? "text" : "password"} 
                              className={`form-control ${fieldErrors.confirmPassword ? "is-invalid" : ""}`}
                              autoComplete="new-password" 
                              placeholder="Confirm Password"
                              value={confirmPassword}
                              onChange={(e) => {
                                setConfirmPassword(e.target.value);
                                setFieldErrors((prev) => ({ ...prev, confirmPassword: "" }));
                              }}
                              style={{ borderRight: 'none' }}
                            />
                            <button 
                              className="btn btn-outline-secondary px-3" 
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              style={{ 
                                borderLeft: 'none',
                                backgroundColor: 'transparent',
                                borderTopRightRadius: '4px',
                                borderBottomRightRadius: '4px',
                                borderColor: 'var(--bs-border-color)'
                              }}
                            >
                              <LucideIcon name={showConfirmPassword ? "eye-off" : "eye"} style={{ width: '16px', height: '16px' }} />
                            </button>
                          </div>
                          {fieldErrors.confirmPassword && (
                            <div className="invalid-feedback d-block">{fieldErrors.confirmPassword}</div>
                          )}
                        </div>
                        <div className="form-check mb-3">
                          <input
                            type="checkbox"
                            className={`form-check-input ${fieldErrors.terms ? "is-invalid" : ""}`}
                            id="authCheck"
                            checked={agreeToTerms}
                            onChange={(e) => {
                              setAgreeToTerms(e.target.checked);
                              setFieldErrors((prev) => ({ ...prev, terms: "" }));
                            }}
                          />
                          <label className="form-check-label ms-1" htmlFor="authCheck">
                            I agree to the terms and conditions
                          </label>
                          {fieldErrors.terms && <div className="invalid-feedback d-block">{fieldErrors.terms}</div>}
                        </div>
                        <div className="text-center pt-2">
                          <button 
                            type="submit" 
                            className="btn btn-primary d-block w-100 text-white py-2 mb-3 shadow-sm fw-bold"
                            disabled={loading}
                          >
                            {loading ? "Creating account..." : "Sign Up"}
                          </button>
                        </div>
                        <p className="mt-3 text-secondary text-center fs-14px">
                          Already have an account? <Link to="/login" className="text-primary fw-bold text-decoration-none ms-1">Log in</Link>
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
    </div>
  );
}

