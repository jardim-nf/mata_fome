// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAyd7CwO4G8slFVDzS4lmNILa9O3eXSq_o",
  authDomain: "matafome-98455.firebaseapp.com",
  projectId: "matafome-98455",
  storageBucket: "matafome-98455.firebasestorage.app",
  messagingSenderId: "39869963505",
  appId: "1:39869963505:web:13567bd25520a6499f5d50",
  measurementId: "G-L8J0082YM3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);