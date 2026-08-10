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

/** Proveedor global para inicio de sesión mediante Google */
const googleProvider = new GoogleAuthProvider();

/**
 * Estructura del contexto global de autenticación de WebYun.
 */
interface AuthContextType {
  /** Usuario de Firebase actualmente autenticado (`null` si no hay sesión) */
  user: User | null;
  /** Estado de carga inicial mientras se verifica la sesión persistida */
  loading: boolean;
  /** Inicia sesión con correo electrónico y contraseña */
  login: (email: string, password: string) => Promise<void>;
  /** Registra un nuevo usuario con email y contraseña en Firebase Auth y Firestore */
  register: (email: string, password: string, nombre?: string) => Promise<void>;
  /** Inicia sesión desplegando el popup de Google Auth */
  loginWithGoogle: () => Promise<void>;
  /** Cierra la sesión activa del usuario */
  logout: () => Promise<void>;
}

/** Contexto React de Autenticación */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Proveedor del Contexto de Autenticación (`AuthProvider`).
 * Administra el estado global de sesión de Firebase, validación de estado inhabilitado en Firestore
 * y provee los métodos de login, registro, Google Sign-In y logout a toda la aplicación.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Escucha cambios en el estado de autenticación de Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Verifica en Firestore si el usuario fue inhabilitado por un administrador
        try {
          const { db } = await import("./firebase");
          const { getDoc, doc } = await import("firebase/firestore");
          const snap = await getDoc(doc(db, "usuarios", firebaseUser.uid));
          if (snap.exists() && snap.data()?.deshabilitado === true) {
            // Si la cuenta está inhabilitada, fuerza el cierre de sesión inmediato
            await signOut(auth);
            setUser(null);
            setLoading(false);
            return;
          }
        } catch {
          // Si falla por problemas de red, se permite continuar para no bloquear usuarios
        }
        setUser(firebaseUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  /**
   * Inicia sesión con correo y contraseña, validando que la cuenta no esté inhabilitada.
   */
  const login = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
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

  /**
   * Registra una nueva cuenta de usuario y guarda su perfil inicial en Firestore.
   */
  const register = async (email: string, password: string, nombre?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (nombre) {
      const { updateProfile } = await import("firebase/auth");
      await updateProfile(cred.user, { displayName: nombre });
    }
    await addUsuario(cred.user.uid, email, nombre);
  };

  /**
   * Autentica al usuario mediante una ventana emergente (popup) de Google Sign-In.
   */
  const loginWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
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
      // Si el registro inicial falla silenciosamente, el usuario ya ha iniciado sesión en Auth
    }
  };

  /**
   * Cierra la sesión activa en Firebase Auth.
   */
  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook personalizado para acceder al contexto global de autenticación.
 * @throws Error si se invoca fuera de un `AuthProvider`.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe ser utilizado dentro de un AuthProvider");
  }
  return context;
}

