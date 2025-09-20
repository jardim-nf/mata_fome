export default function MesaCard({ mesa, onClick }) {
  const statusColors = {
    livre: "bg-green-200 border-green-500",
    aberta: "bg-yellow-200 border-yellow-500",
    fechada: "bg-red-200 border-red-500",
  };

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer border-2 rounded-xl p-4 text-center shadow ${statusColors[mesa.status]}`}
    >
      <h2 className="text-lg font-semibold">Mesa {mesa.numero}</h2>
      <p className="text-sm capitalize">Status: {mesa.status}</p>
    </div>
  );
}
