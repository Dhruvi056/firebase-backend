// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional

const firebaseConfig = {
  apiKey: "AIzaSyDWjspbdzDxChkNn9doFYWHexWw_EhbU8k",
  authDomain: "fir-1e4bf.firebaseapp.com",
  projectId: "fir-1e4bf",
  storageBucket: "fir-1e4bf.firebasestorage.app",
  messagingSenderId: "770993138414",
  appId: "1:770993138414:web:7cf9bd29af808edd05a1ff",
  measurementId: "G-HVJYR29EW4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { db };