import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FaSpinner } from "react-icons/fa";

const withAuth = (WrappedComponent, options = {}) => {
  const { requireAdmin = false, requireMaster = false } = options;

  return (props) => {
    const { currentUser, isAdmin, isMaster, authLoading, userData } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [shouldRedirect, setShouldRedirect] = useState(false);
    const [redirectPath, setRedirectPath] = useState("");

    // Usar estabelecimentos ou estabelecimentosGerenciados
    const estabelecimentoPrincipal = userData?.estabelecimentos?.[0] || 
                                   userData?.estabelecimentosGerenciados?.[0] || 
                                   null;

    console.log("🔐 Debug Auth HOC:", { 
      currentUser, 
      isAdmin, 
      isMaster, 
      authLoading, 
      estabelecimentoPrincipal,
      estabelecimentos: userData?.estabelecimentos,
      estabelecimentosGerenciados: userData?.estabelecimentosGerenciados
    });

    useEffect(() => {
      if (!authLoading) {
        // Usuário não autenticado
        if (!currentUser) {
          setRedirectPath("/login");
          setShouldRedirect(true);
          return;
        }

        // Requer admin mas não é admin
        if (requireAdmin && !isAdmin) {
          setRedirectPath("/unauthorized");
          setShouldRedirect(true);
          return;
        }

        // Requer master mas não é master
        if (requireMaster && !isMaster) {
          setRedirectPath("/unauthorized");
          setShouldRedirect(true);
          return;
        }

        // Admin sem estabelecimento configurado
        if (isAdmin && !isMaster && !estabelecimentoPrincipal) {
          console.log("❌ Admin sem estabelecimento configurado");
          setRedirectPath("/select-establishment");
          setShouldRedirect(true);
          return;
        }

        setLoading(false);
      }
    }, [currentUser, isAdmin, isMaster, authLoading, estabelecimentoPrincipal, requireAdmin, requireMaster]);

    // Efeito separado para navegação
    useEffect(() => {
      if (shouldRedirect && redirectPath) {
        navigate(redirectPath);
      }
    }, [shouldRedirect, redirectPath, navigate]);

    if (loading || authLoading) {
      return (
        <div className="flex justify-center items-center min-h-screen">
          <FaSpinner className="animate-spin text-2xl text-blue-500" />
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };
};

export default withAuth;