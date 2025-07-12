// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth"; // <--- ADICIONE ESTA IMPORTAÇÃO PARA AUTENTICAÇÃO
import { getFirestore } from "firebase/firestore"; // <--- ADICIONE ESTA IMPORTAÇÃO PARA FIRESTORE

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAyd7CwO4G8slFVDzS4lmNILa9O3eXSq_o",
  authDomain: "matafome-98455.firebaseapp.com",
  projectId: "matafome-98455",
  storageBucket: "matafome-98455.firebasestorage.app",
  messagingSenderId: "39869963505",
  appId: "1:39869963505:web:13567bd25520a6499f5d50",
  measurementId: "G-L8J0082YM3"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firebase services and export them
const auth = getAuth(app); // <--- INICIALIZE E EXPORTE AUTH
const db = getFirestore(app); // <--- INICIALIZE E EXPORTE FIRESTORE
const analytics = getAnalytics(app); // Analytics também pode ser exportado se usado

export { app, auth, db, analytics }; // <--- EXPORTE TODOS OS SERVIÇOS QUE VOCÊ USA