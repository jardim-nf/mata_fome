import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FaSpinner } from "react-icons/fa";

const withEstablishmentAuth = (WrappedComponent) => {
  const WithEstablishmentAuthComponent = (props) => {
    const { currentUser, userData, authLoading , estabelecimentoIdPrincipal } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [shouldRedirect, setShouldRedirect] = useState(false);
    const [redirectPath, setRedirectPath] = useState("");

    // Usar estabelecimentos ou estabelecimentosGerenciados
    const estabelecimentoPrincipal = estabelecimentoIdPrincipal || 
                                   estabelecimentoIdPrincipal || 
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

    return <WrappedComponent {...props} estabelecimentoPrincipal={estabelecimentoPrincipal} />;
  };

  WithEstablishmentAuthComponent.displayName = `withEstablishmentAuth(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
  return WithEstablishmentAuthComponent;
};

export default withEstablishmentAuth;