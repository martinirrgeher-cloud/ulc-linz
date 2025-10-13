import { useEffect, useState } from "react";
import { FaRunning, FaChild, FaUsers, FaBook, FaSignOutAlt } from "react-icons/fa";
import { logout } from "../lib/googleAuth";

export default function Dashboard() {
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("loggedInUser");
    if (stored) {
      const user = JSON.parse(stored);
      setUserRole(user.role);
    }
  }, []);

  const modules = [
    {
      title: "Kindertraining",
      icon: <FaChild size={40} />,
      description: "Anwesenheit, Notizen, Auswertung",
      path: "/kindertraining",
      roles: ["admin", "trainer"],
    },
    {
      title: "U12",
      icon: <FaRunning size={40} />,
      description: "Trainingsplanung & Anwesenheit U12",
      path: "/u12",
      roles: ["admin", "trainer"],
    },
    {
      title: "U14",
      icon: <FaUsers size={40} />,
      description: "Trainingsplanung & Anwesenheit U14",
      path: "/u14",
      roles: ["admin", "trainer"],
    },
    {
      title: "Übungskatalog",
      icon: <FaBook size={40} />,
      description: "Übungen verwalten und teilen",
      path: "/uebungskatalog",
      roles: ["admin"],
    },
  ];

  const handleLogout = () => {
    logout();
    localStorage.removeItem("loggedInUser");
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-4xl font-extrabold text-ulc-green leading-tight">
  ULC Linz Oberbank
</h1>
<h2 className="text-2xl text-ulc-green/80 font-semibold">
  Modulübersicht
</h2>

        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition"
        >
          <FaSignOutAlt /> Logout
        </button>
      </div>

      {/* Module Grid */}
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {modules
          .filter((m) => !userRole || m.roles.includes(userRole))
          .map((m) => (
           <a
  key={m.title}
  href={m.path}
  className="group block bg-white border-2 !border-black rounded-xl p-8 
             shadow-md hover:shadow-2xl hover:!border-gray-800
             transition-all duration-300 transform hover:-translate-y-1 hover:scale-105
             flex flex-col justify-between items-center text-center h-60"
>
  <div
    className="!text-black group-hover:!text-white 
               bg-gray-100 group-hover:!bg-black
               rounded-full p-4 mb-4 transition-colors duration-300"
  >
    {m.icon}
  </div>
  <h2 className="text-xl font-semibold mb-2 !text-black group-hover:!text-white transition-colors duration-300">
    {m.title}
  </h2>
  <p className="!text-gray-600 group-hover:!text-white text-sm transition-colors duration-300">
    {m.description}
  </p>
</a>




          ))}
      </div>
    </div>
  );
}
