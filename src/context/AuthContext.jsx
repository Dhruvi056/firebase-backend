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

  async function signup(email, password) {
    if (!auth) {
      throw new Error("Firebase Auth is not initialized. Please check your Firebase configuration.");
    }
    
    console.log("Attempting signup with:", {
      email,
      authDomain: auth.app.options.authDomain,
      projectId: auth.app.options.projectId,
    });
    
   const cred = await createUserWithEmailAndPassword(auth, email, password).catch(
      (error) => {
        console.error("Firebase signup error:", {
          code: error.code,
          message: error.message,
          customData: error.customData,
        });
        throw error;
      }
    );
      try {
      const userDocRef = doc(db, "users", cred.user.uid);
      const payload = {
        email,
        role: "vendor_admin",
        vendorId: cred.user.uid,
        createdAt: new Date().toISOString(),
      };
      console.log("Creating user meta document at /users/" + cred.user.uid, payload);
      await setDoc(userDocRef, payload, { merge: true });
      console.log("User meta document created successfully");
    } catch (metaError) {
      console.error("Error creating user meta document:", metaError);
    }

    return cred;
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  function resetPassword(email) {
    if (!auth) {
      throw new Error("Firebase Auth is not initialized. Please check your Firebase configuration.");
    }
    return sendPasswordResetEmail(auth, email);
  }

useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    setCurrentUser(user);

    if (user) {
      try {
        const ref = doc(db, "users", user.uid);
        console.log("Loading user meta from /users/" + user.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          console.log("User meta found:", snap.data());
          setUserMeta(snap.data());
        } else {
          const fallback = {
            email: user.email,
            role: "vendor_admin",
            vendorId: user.uid,
          };
          console.log("User meta missing; creating fallback:", fallback);
          setUserMeta(fallback);
          await setDoc(ref, fallback, { merge: true });
          console.log("Fallback user meta written to Firestore");
        }
      } catch (err) {
        console.error("Failed to load user meta:", err);
        setUserMeta(null);
      }
    } else {
      console.log("No user signed in; clearing userMeta");
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
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

