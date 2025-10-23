import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { initGoogleAuth, getAccessToken } from "@/lib/googleAuth";

interface User {
  username: string;
  modules: string[];
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  loginGoogle: () => Promise<void>;
  loginUser: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  switchUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem("google_access_token"));
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("google_access_token");
    setToken(null);
    setUser(null);
    navigate("/login1");
  };

  const switchUser = () => {
    setUser(null);
    navigate("/login2");
  };

  const loginGoogle = async () => {
    try {
      await initGoogleAuth();
      const newToken = getAccessToken();
      if (newToken) {
  localStorage.setItem("google_access_token", newToken);
  setToken(newToken);
  navigate("/login2");
} else {
        console.error("Kein Token erhalten");
      }
    } catch (err) {
      console.error("Fehler beim Google Login", err);
    }
  };

  const loginUser = async (username: string, password: string) => {
    try {
      const accessToken = getAccessToken();
      if (!accessToken) {
        console.error("Kein Google Token vorhanden.");
        return false;
      }

      const fileId = import.meta.env.VITE_DRIVE_USERS_FILE_ID; // 🔸 .env prüfen!
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        console.error("Fehler beim Laden der users.json");
        return false;
      }

      const json = await response.json();
      const foundUser = json.users.find(
        (u: any) => u.username === username && u.password === password
      );

      if (!foundUser) {
        console.error("Ungültige Anmeldedaten");
        return false;
      }

      // ✅ Benutzer setzen und weiterleiten
      setUser(foundUser);
      navigate("/dashboard");
      return true;
    } catch (err) {
      console.error("Fehler beim Login 2:", err);
      return false;
    }
  };

  useEffect(() => {
    const storedToken = getAccessToken();
    if (storedToken) setToken(storedToken);
  }, []);

  const value: AuthContextType = {
    token,
    user,
    loginGoogle,
    loginUser,
    logout,
    switchUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
