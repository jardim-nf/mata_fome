import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FaSpinner } from "react-icons/fa";

const withEstablishmentAuth = (WrappedComponent) => {
  return (props) => {
    const { currentUser, userData, authLoading } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [shouldRedirect, setShouldRedirect] = useState(false);
    const [redirectPath, setRedirectPath] = useState("");

    // Usar estabelecimentos ou estabelecimentosGerenciados
    const estabelecimentoPrincipal = userData?.estabelecimentos?.[0] || 
                                   userData?.estabelecimentosGerenciados?.[0] || 
                                   null;

    useEffect(() => {
      if (!authLoading) {
        if (!currentUser) {
          setRedirectPath("/login");
          setShouldRedirect(true);
          return;
        }

        if (!estabelecimentoPrincipal) {
          setRedirectPath("/select-establishment");
          setShouldRedirect(true);
          return;
        }

        setLoading(false);
      }
    }, [currentUser, estabelecimentoPrincipal, authLoading, navigate]);

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

export default withEstablishmentAuth;