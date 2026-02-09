import { ShieldX, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import logoVV from "@/assets/logo-vv-beneficios-transparente.png";
const UsuarioInativo = () => {
  const {
    signOut
  } = useAuth();
  return <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <img alt="VV Benefícios" className="h-12 mx-auto mb-4" src="/lovable-uploads/c01a11b4-e16a-45c4-82da-04320cc458c5.png" />
        
        <div className="bg-card border border-border rounded-xl p-8 shadow-lg space-y-5">
          <div className="flex justify-center">
            <div className="bg-destructive/10 p-4 rounded-full">
              <ShieldX className="h-10 w-10 text-destructive" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-foreground">
            Usuário Inativo
          </h1>

          <p className="text-muted-foreground leading-relaxed">
            Sua conta está atualmente <strong className="text-destructive">inativa</strong>. 
            Você não possui acesso ao sistema no momento.
          </p>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Entre em contato com o suporte:</p>
            <div className="flex items-center justify-center gap-2">
              <Mail className="h-4 w-4" />
              <span>suporte@vvbeneficios.com.br</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Phone className="h-4 w-4" />
              <span>(71) 99654-5751</span>
            </div>
          </div>

          <Button variant="outline" onClick={signOut} className="w-full">
            Sair da conta
          </Button>
        </div>
      </div>
    </div>;
};
export default UsuarioInativo;