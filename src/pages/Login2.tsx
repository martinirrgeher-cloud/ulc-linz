import React, { useState } from "react";
import { useAuth } from "@/store/AuthContext";
import '@/styles/login.css'


export default function Login2() {
  const { loginUser } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await loginUser(username, password);
    if (!success) setError("Benutzername oder Passwort falsch");
  };

  return (
    <div className="login2-page">
      <h2>Benutzeranmeldung</h2>
      <form onSubmit={handleSubmit}>
        <input placeholder="Benutzername" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input type="password" placeholder="Passwort" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">Anmelden</button>
      </form>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}