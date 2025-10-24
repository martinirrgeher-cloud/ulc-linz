import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { initGoogleAuth, getAccessToken, validateGoogleToken } from "@/lib/googleAuth";

interface AuthContextType {
  token: string | null;
  user: any;
  loginGoogle: () => Promise<void>;
  loginUser: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  switchUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  // 🔸 Token beim Start prüfen
  useEffect(() => {
    const storedToken = localStorage.getItem("google_access_token");
    if (storedToken) {
      validateGoogleToken(storedToken)
        .then((valid) => {
          if (valid) {
            setToken(storedToken);
            navigate("/login2");
          } else {
            localStorage.removeItem("google_access_token");
            setToken(null);
            navigate("/login1");
          }
        })
        .catch(() => {
          localStorage.removeItem("google_access_token");
          setToken(null);
          navigate("/login1");
        });
    } else {
      navigate("/login1");
    }
  }, [navigate]);

  const loginGoogle = async () => {
    try {
      await initGoogleAuth();
      const newToken = getAccessToken();
      if (newToken) {
        const valid = await validateGoogleToken(newToken);
        if (valid) {
          localStorage.setItem("google_access_token", newToken);
          setToken(newToken);
          navigate("/login2");
        } else {
          localStorage.removeItem("google_access_token");
          setToken(null);
          navigate("/login1");
        }
      } else {
        console.error("Kein Token erhalten");
      }
    } catch (err) {
      console.error("Fehler beim Google Login", err);
    }
  };

  const loginUser = async (username: string, password: string) => {
    try {
      const response = await fetch("/users.json");
      const users = await response.json();
      const foundUser = users.find(
        (u: any) => u.username === username && u.password === password
      );
      if (!foundUser) {
        return false;
      }

      setUser(foundUser);
      navigate("/dashboard");
      return true;
    } catch (err) {
      console.error("Fehler beim Login 2:", err);
      return false;
    }
  };

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

  return (
    <AuthContext.Provider value={{ token, user, loginGoogle, loginUser, logout, switchUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth muss innerhalb eines AuthProviders verwendet werden");
  }
  return context;
};
