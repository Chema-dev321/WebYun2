"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User,
} from "firebase/auth";
import { auth } from "./firebase";
import { addUsuario } from "./firestore";

const googleProvider = new GoogleAuthProvider();

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nombre?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Verificar si el usuario está inhabilitado en Firestore
        try {
          const { db } = await import("./firebase");
          const { getDoc, doc } = await import("firebase/firestore");
          const snap = await getDoc(doc(db, "usuarios", firebaseUser.uid));
          if (snap.exists() && snap.data()?.deshabilitado === true) {
            // Cerrar sesión automáticamente si está inhabilitado
            await signOut(auth);
            setUser(null);
            setLoading(false);
            return;
          }
        } catch {
          // Si falla la comprobación, dejamos pasar (no bloquear por error de red)
        }
        setUser(firebaseUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    // Verificar inhabilitado justo después del login
    try {
      const { db } = await import("./firebase");
      const { getDoc, doc } = await import("firebase/firestore");
      const snap = await getDoc(doc(db, "usuarios", cred.user.uid));
      if (snap.exists() && snap.data()?.deshabilitado === true) {
        await signOut(auth);
        throw new Error("Esta cuenta ha sido inhabilitada. Contacta al administrador.");
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("inhabilitada")) throw err;
    }
  };

  const register = async (email: string, password: string, nombre?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (nombre) {
      const { updateProfile } = await import("firebase/auth");
      await updateProfile(cred.user, { displayName: nombre });
    }
    await addUsuario(cred.user.uid, email, nombre);
  };

  const loginWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    // Verificar inhabilitado
    try {
      const { db } = await import("./firebase");
      const { getDoc, doc } = await import("firebase/firestore");
      const snap = await getDoc(doc(db, "usuarios", result.user.uid));
      if (snap.exists() && snap.data()?.deshabilitado === true) {
        await signOut(auth);
        throw new Error("Esta cuenta ha sido inhabilitada. Contacta al administrador.");
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("inhabilitada")) throw err;
    }
    try {
      await addUsuario(result.user.uid, result.user.email || "", result.user.displayName || undefined);
    } catch {
      // Firestore write can fail silently — user is already signed in
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
