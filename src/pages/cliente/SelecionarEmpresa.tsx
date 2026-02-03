import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { Building2, ChevronRight, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import logoVV from "@/assets/logo-vv-new.png";

const SelecionarEmpresa = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { 
    empresasVinculadas, 
    setEmpresaAtiva, 
    loading, 
    isCliente,
    role 
  } = useUserRole();
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    // Se não for cliente, redirecionar
    if (!loading && role && !isCliente) {
      navigate("/");
    }
  }, [loading, role, isCliente, navigate]);

  const handleSelectEmpresa = async (empresaId: string) => {
    setSelecting(empresaId);
    await setEmpresaAtiva(empresaId);
    navigate("/cliente/dashboard");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-xl p-2 shadow-sm">
              <img src={logoVV} alt="VV Benefícios" className="h-8 w-auto object-contain" />
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={signOut}
            className="text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Selecione uma Empresa
          </h1>
          <p className="text-muted-foreground text-lg">
            Você tem acesso a {empresasVinculadas.length} empresa{empresasVinculadas.length > 1 ? 's' : ''}. Escolha qual deseja acessar.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {empresasVinculadas.map((empresa) => (
            <Card
              key={empresa.id}
              className={`group cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-primary/50 hover:scale-[1.02] ${
                selecting === empresa.id ? 'border-primary shadow-lg scale-[1.02]' : ''
              }`}
              onClick={() => handleSelectEmpresa(empresa.id)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground truncate text-lg">
                        {empresa.nome}
                      </h3>
                      <p className="text-sm text-muted-foreground font-mono">
                        {empresa.cnpj?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') || 'CNPJ não informado'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className={`h-5 w-5 text-muted-foreground transition-all group-hover:text-primary group-hover:translate-x-1 ${
                    selecting === empresa.id ? 'text-primary translate-x-1' : ''
                  }`} />
                </div>
                {selecting === empresa.id && (
                  <div className="mt-4 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    <span className="ml-2 text-sm text-muted-foreground">Carregando...</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {empresasVinculadas.length === 0 && (
          <div className="text-center py-16">
            <Building2 className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhuma empresa vinculada
            </h3>
            <p className="text-muted-foreground">
              Entre em contato com o administrador para vincular uma empresa ao seu usuário.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default SelecionarEmpresa;
