// src/services/authService.js
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';
import { auth } from '../firebase';

export const doCreateUserWithEmailAndPassword = async (email, password, displayName = '') => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);

  if (displayName) {
    await updateProfile(userCredential.user, { displayName });
  }

  return userCredential;
};

export const doSignInWithEmailAndPassword = (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const doSignOut = () => {
  return signOut(auth);
};
