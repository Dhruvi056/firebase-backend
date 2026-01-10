import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

function PrivateRoute({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" />;
}

function PublicRoute({ children }) {
  const { currentUser } = useAuth();
  return !currentUser ? children : <Navigate to="/" />;
}

function RoutePersist() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  useEffect(() => {
    // Save current route to localStorage (except login/signup)
    const currentPath = location.pathname;
    if (currentPath !== "/login" && currentPath !== "/signup") {
      localStorage.setItem("lastRoute", currentPath);
    }
  }, [location]);

  useEffect(() => {
    // Restore route on refresh if user is logged in
    // Only run once when component mounts and user is authenticated
    if (currentUser) {
      const lastRoute = localStorage.getItem("lastRoute");
      // Only restore if we're on home page (/) and there's a saved route that's different
      if (lastRoute && lastRoute !== "/" && lastRoute !== "/login" && lastRoute !== "/signup") {
        // Only navigate if we're on the home page, not if we're already on a specific route
        if (location.pathname === "/") {
          navigate(lastRoute, { replace: true });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]); // Only run when currentUser changes, not on every pathname change

  return null;
}

function AppRoutes() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Redirect to login on first visit or when not authenticated
  useEffect(() => {
    if (!currentUser) {
      if (location.pathname === "/" || location.pathname === "") {
        navigate("/login", { replace: true });
      }
    }
  }, [currentUser, location.pathname, navigate]);

  return (
    <>
      <RoutePersist />
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute>
              <Signup />
            </PublicRoute>
          }
        />
        <Route
          path="/forms/:formId"
          element={
            currentUser ? (
              <PrivateRoute>
                <Home />
              </PrivateRoute>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/"
          element={
            currentUser ? (
              <PrivateRoute>
                <Home />
              </PrivateRoute>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="*"
          element={
            currentUser ? (
              <Navigate to="/" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </>
  );
}

function App() {
  return (
    <ToastProvider>
      <Router basename="/">
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Router>
    </ToastProvider>
  );
}

export default App;
