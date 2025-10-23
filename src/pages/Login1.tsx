import React, { useEffect } from "react";
import { useAuth } from "@/store/AuthContext";
import { initGoogleAuth } from "@/lib/googleAuth";
import '@/styles/login.css'


export default function Login1() {
  const { loginGoogle } = useAuth();

  useEffect(() => {
    initGoogleAuth();
  }, []);

  return (
    <div className="login-page">
      <h1>Login</h1>
      <button onClick={loginGoogle}>Mit Google anmelden</button>
    </div>
  );
}