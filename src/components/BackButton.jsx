import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IoArrowBackOutline } from 'react-icons/io5';

const BackButton = ({ to, onClick, label = "Voltar", className = "" }) => {
  const navigate = useNavigate();
  const isDark = localStorage.getItem('dashboard_theme') === 'dark';

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
      className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all active:scale-95 w-fit shadow-sm border ${
        isDark 
          ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200' 
          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
      } ${className}`}
    >
      <IoArrowBackOutline className="text-xl" />
      <span className="text-sm">{label}</span>
    </button>
  );
};

export default BackButton;
