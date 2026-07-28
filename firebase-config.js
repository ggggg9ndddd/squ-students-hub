import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCU-QL2QNxUFoxe4iIDN4sBvIWPW33L3e8",
  authDomain: "squ-students-hub.firebaseapp.com",
  projectId: "squ-students-hub",
  storageBucket: "squ-students-hub.firebasestorage.app",
  messagingSenderId: "591521486219",
  appId: "1:591521486219:web:7c2ab71222ebb481b3cb8e",
  measurementId: "G-7BCYKKBEP8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export { app, auth, db, googleProvider };
