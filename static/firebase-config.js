import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBPLHx2jq2vJtNBdCawmdpoJXEokpvJZUY",
  authDomain: "projetocroqui-105df.firebaseapp.com",
  projectId: "projetocroqui-105df",
  storageBucket: "projetocroqui-105df.firebasestorage.app",
  messagingSenderId: "841381733055",
  appId: "1:841381733055:web:d61f29eaa2c45f0fb25c0a",
  
  // ⚠️ Confirme se esta URL corresponde EXATAMENTE à mostrada no Console do Firebase:
  databaseURL: "https://projetocroqui-105df-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);