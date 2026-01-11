import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  function signup(email, password) {
    if (!auth) {
      throw new Error("Firebase Auth is not initialized. Please check your Firebase configuration.");
    }
    
    console.log("Attempting signup with:", {
      email,
      authDomain: auth.app.options.authDomain,
      projectId: auth.app.options.projectId,
    });
    
    return createUserWithEmailAndPassword(auth, email, password)
      .catch((error) => {
        console.error("Firebase signup error:", {
          code: error.code,
          message: error.message,
          customData: error.customData,
        });
        throw error;
      });
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    loading,
    signup,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

