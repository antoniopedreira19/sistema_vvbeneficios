import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";

// Nova logo VV Benefícios
import logoVV from "@/assets/logo-vv-new.png";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        toast({
          title: "Acesso Negado",
          description: "Credenciais inválidas. Verifique seu e-mail e senha.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Login realizado",
          description: "Acessando o sistema...",
          action: <CheckCircle2 className="h-5 w-5 text-vv-success" />,
        });
        navigate("/");
      }
    } catch (error) {
      toast({
        title: "Erro de Conexão",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen lg:grid lg:grid-cols-2">
      {/* --- COLUNA ESQUERDA (BRANDING) --- */}
      <div className="hidden lg:flex relative flex-col items-center justify-center h-full overflow-hidden bg-accent">
        {/* Padrão geométrico sutil */}
        <div className="absolute inset-0 opacity-5">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <circle cx="30" cy="30" r="20" fill="none" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" className="text-white" />
          </svg>
        </div>

        {/* Gradiente overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-accent via-accent to-[hsl(210,21%,20%)]" />

        {/* Elemento decorativo amarelo */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-primary/10 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />

        {/* CONTEÚDO CENTRALIZADO */}
        <div className="relative z-10 flex flex-col items-center max-w-lg text-center px-12">
          {/* Logo com fundo branco arredondado */}
          <div className="bg-white p-8 rounded-3xl shadow-vv-lg mb-10 animate-scale-in">
            <img 
              src={logoVV} 
              alt="VV Benefícios" 
              className="h-24 w-auto object-contain" 
            />
          </div>

          {/* Linha decorativa amarela */}
          <div className="w-20 h-1 bg-primary rounded-full mb-8" />

          {/* Tagline da empresa */}
          <blockquote className="animate-fade-in">
            <p className="text-xl md:text-2xl font-medium leading-relaxed text-white/95 mb-8">
              "Nosso propósito é aumentar o nível de segurança e satisfação dos colaboradores das empresas conveniadas."
            </p>
          </blockquote>

          {/* Badge sistema */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-5 py-2.5">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-sm font-medium text-white/90 tracking-wide">
              Sistema Integrado de Gestão
            </span>
          </div>
        </div>

        {/* Rodapé */}
        <div className="absolute bottom-8 text-sm text-white/50">
          &copy; {new Date().getFullYear()} VV Benefícios. Todos os direitos reservados.
        </div>
      </div>

      {/* --- COLUNA DIREITA (LOGIN) --- */}
      <div className="flex items-center justify-center py-12 px-4 sm:px-8 lg:p-12 bg-background min-h-screen">
        <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[420px]">
          {/* Card de Login */}
          <div className="bg-card p-8 sm:p-10 rounded-2xl shadow-vv border border-border">
            {/* Header Mobile com Logo */}
            <div className="flex flex-col space-y-2 text-center lg:text-left mb-8">
              <div className="lg:hidden mx-auto mb-6">
                <img src={logoVV} alt="VV Benefícios" className="h-16 w-auto" />
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Bem-vindo(a) de volta
              </h1>
              <p className="text-sm text-muted-foreground">
                Insira suas credenciais para acessar o painel.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* E-mail */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-medium">
                  E-mail Corporativo
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="nome@empresa.com"
                    className="pl-10 h-12 bg-secondary/50 border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              {/* Senha */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground font-medium">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 pr-10 h-12 bg-secondary/50 border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Botão de Login */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base shadow-md hover:shadow-lg transition-all duration-200"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Acessando...
                  </div>
                ) : (
                  "Entrar na Plataforma"
                )}
              </Button>
            </form>
          </div>

          {/* Tagline mobile */}
          <p className="lg:hidden text-center text-xs text-muted-foreground px-4">
            "Nosso propósito é aumentar o nível de segurança e satisfação dos colaboradores das empresas conveniadas."
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
