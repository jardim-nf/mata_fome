// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBMe3VD7wEQJeyovVDwRS01nWnebAtkcgM",
  authDomain: "matafome-a4926.firebaseapp.com",
  projectId: "matafome-a4926",
  storageBucket: "matafome-a4926.firebasestorage.app",
  messagingSenderId: "866002554434",
  appId: "1:866002554434:web:1f8c98e76c6e8df9d2a7db",
  measurementId: "G-Y9Y275QZ3T"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);