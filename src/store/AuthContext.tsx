// src/store/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  initGoogleAuth,
  loginGoogle as googleLogin,
  getAccessToken,
  validateGoogleToken,
  logoutGoogle,
  clearStorage,
} from "@/lib/googleAuth";
import { fetchUsersAndLogin } from "@/lib/users";

interface User {
  username: string;
  password: string;
  modules?: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loginGoogle: () => Promise<void>;
  loginUser: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loginGoogle: async () => {},
  loginUser: async () => false,
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const navigate = useNavigate();

  // ----------------------------------
  // Google Login (Popup)
  // ----------------------------------
  const loginGoogle = async () => {
    await initGoogleAuth();
    await googleLogin();
    const newToken = getAccessToken();
    if (newToken) {
      setToken(newToken);
      navigate("/login2");
    } else {
      console.error("❌ Kein Token erhalten.");
    }
  };

  // ----------------------------------
  // Login 2 → Benutzerdatei laden
  // ----------------------------------
  const loginUser = async (username: string, password: string): Promise<boolean> => {
    try {
      const user = await fetchUsersAndLogin(username, password);
      if (user) {
        console.log("✅ Login erfolgreich für Benutzer:", user.username);
        setUser(user);
        navigate("/dashboard"); // nach Login zur Hauptseite
        return true;
      } else {
        console.warn("⚠️ Benutzername oder Passwort ungültig.");
        return false;
      }
    } catch (err) {
      console.error("❌ Fehler beim Login 2:", err);
      return false;
    }
  };

  // ----------------------------------
  // Token beim Start validieren
  // ----------------------------------
  useEffect(() => {
    const checkToken = async () => {
      const storedToken = getAccessToken();
      if (storedToken) {
        const valid = await validateGoogleToken(storedToken);
        if (valid) {
          setToken(storedToken);
        } else {
          clearStorage();
        }
      }
    };
    checkToken();
  }, []);

  // ----------------------------------
  // Logout
  // ----------------------------------
  const logout = () => {
    logoutGoogle();
    setToken(null);
    setUser(null);
    navigate("/login1");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loginGoogle,
        loginUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
