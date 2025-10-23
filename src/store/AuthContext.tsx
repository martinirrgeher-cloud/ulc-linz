import React, { createContext, useContext, useEffect, useState } from "react";
import { getAccessToken, silentRefreshIfNeeded, clearStorage, requestAccessToken } from "@/lib/googleAuth";
import { fetchUsersAndLogin } from "@/lib/users";
import { useNavigate } from "react-router-dom";

interface User {
  username: string;
  role: string;
  modules: string[];
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  loginGoogle: () => Promise<void>;
  loginUser: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const t = getAccessToken();
    if (t) setToken(t);
  }, []);

  async function ensureValidToken() {
    const refreshed = await silentRefreshIfNeeded();
    if (refreshed) {
      const t = getAccessToken();
      if (t) setToken(t);
    } else {
      handleLogout();
    }
  }

  function handleLogout() {
    clearStorage();
    setToken(null);
    setUser(null);
    navigate("/login1");
  }

  async function loginGoogle() {
    await requestAccessToken();
    const t = getAccessToken();
    if (t) {
      setToken(t);
      navigate("/login2");
    }
  }

 async function loginUser(username: string, password: string) {
  const loggedInUser = await fetchUsersAndLogin(username, password);
  if (loggedInUser) {
    setUser(loggedInUser);
    navigate("/dashboard");  // ✅ statt "/"
    return true;
  }
  return false;
}


  useEffect(() => {
    const interval = setInterval(() => {
      if (token) ensureValidToken();
    }, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

  const value: AuthContextType = {
    token,
    user,
    loginGoogle,
    loginUser,
    logout: handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};