import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IoArrowBackOutline } from 'react-icons/io5';

const BackButton = ({ to, onClick, label = "Voltar", className = "" }) => {
  const navigate = useNavigate();

  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
      return;
    }
    if (to) {
      navigate(to);
      return;
    }
    navigate(-1);
  };

  return (
    <button
      onClick={handleClick}
      type="button"
      className={`flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm rounded-xl text-slate-600 font-semibold transition-all active:scale-95 w-fit ${className}`}
    >
      <IoArrowBackOutline className="text-xl" />
      <span className="text-sm">{label}</span>
    </button>
  );
};

export default BackButton;
