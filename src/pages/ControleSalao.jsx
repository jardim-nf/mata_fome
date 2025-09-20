import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase"; // ajustar caminho do seu firebase.js
import MesaCard from "../components/MesaCard";

export default function ControleSalao() {
  const [mesas, setMesas] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "mesas"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMesas(data);
    });

    return () => unsub();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Controle de Salão</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {mesas.map((mesa) => (
          <MesaCard
            key={mesa.id}
            mesa={mesa}
            onClick={() => navigate(`/mesa/${mesa.id}`)}
          />
        ))}
      </div>
    </div>
  );
}
