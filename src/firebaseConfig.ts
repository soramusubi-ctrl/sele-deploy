import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "", // 環境変数から取得、なければ空文字
  authDomain: "soraai-858d3.firebaseapp.com",
  projectId: "soraai-858d3",
  storageBucket: "soraai-858d3.appspot.com",
  messagingSenderId: "169746028377",
  appId: "1:169746028377:web:7de73355ff80af2c331e48",
  measurementId: "G-9NSX3FZBEM"
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
} catch (error) {
  console.error("Firebase initialization error:", error);
  // Create a mock auth object for development without API key
  app = {} as FirebaseApp;
  auth = {} as Auth;
}

export { auth };
