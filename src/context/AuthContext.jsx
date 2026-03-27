import { createContext, useContext, useEffect, useState } from "react";
import { auth,db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userMeta, setUserMeta] = useState(null);

   async function signup(email, password, name) {
    if (!auth) {
      throw new Error("Firebase Auth is not initialized. Please check your Firebase configuration.");
    }
    
   const cred = await createUserWithEmailAndPassword(auth, email, password).catch(
      (error) => {
        console.error("Firebase signup error:", {
          code: error.code,
          message: error.message,
        });
        throw error;
      }
    );
    try {
      const userDocRef = doc(db, "users", cred.user.uid);
      const payload = {
        name: name || "",
        email,
        role: "vendor_admin",
        vendorId: cred.user.uid,
        createdAt: new Date().toISOString(),
      };
      await setDoc(userDocRef, payload, { merge: true });
    } catch (metaError) {
      console.error("Error creating user meta document:", metaError);
    }

    return cred;
  }

  async function updateUserMeta(data) {
    if (!currentUser) return;
    try {
      const ref = doc(db, "users", currentUser.uid);
      await setDoc(ref, data, { merge: true });
      setUserMeta(prev => ({ ...prev, ...data }));
    } catch (err) {
      console.error("Failed to update user meta:", err);
      throw err;
    }
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  async function resetPassword(email) {
    if (!auth) {
      throw new Error("Firebase Auth is not initialized. Please check your Firebase configuration.");
    }
    
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, origin: window.location.origin })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send reset password email");
      }
      return await response.json();
    } catch (err) {
      console.error("Custom reset password error:", err);
      // Fallback to default firebase if the API fails just in case
      return sendPasswordResetEmail(auth, email);
    }
  }

useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    setCurrentUser(user);

    if (user) {
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setUserMeta(snap.data());
        } else {
          const fallback = {
            email: user.email,
            role: "vendor_admin",
            vendorId: user.uid,
          };
          setUserMeta(fallback);
          await setDoc(ref, fallback, { merge: true });
        }
      } catch (err) {
        console.error("Failed to load user meta:", err);
        setUserMeta(null);
      }
    } else {
      setUserMeta(null);
    }

    setLoading(false);
  });

  return unsubscribe;
}, []);

  const value = {
    currentUser,
    loading,
    userMeta,
    signup,
    login,
    logout,
    resetPassword,
    updateUserMeta,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

