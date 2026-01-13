import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// TEMPORARIAMENTE DESABILITADO - Login bypass
const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redireciona direto para o dashboard
    navigate("/dashboard");
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
};

export default Index;
