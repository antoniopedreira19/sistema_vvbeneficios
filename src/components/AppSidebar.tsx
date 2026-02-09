import { LayoutDashboard, Briefcase, Receipt, Building2, Settings, Upload, Users, History, LogOut, UserCog, ArrowLeftRight } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import EditarPerfilDialog from "@/components/cliente/EditarPerfilDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Logos VV
import logoVV from "@/assets/logo-vv-new.png";
import logoVVIcon from "@/assets/logo-vv-icon.png";
const adminItems = [{
  title: "Visão Geral",
  url: "/admin/dashboard",
  icon: LayoutDashboard
}, {
  title: "Operacional",
  url: "/admin/operacional",
  icon: Briefcase
}, {
  title: "Financeiro",
  url: "/admin/financeiro",
  icon: Receipt,
  adminOrFinanceiro: true
}, {
  title: "Histórico",
  url: "/admin/historico",
  icon: History
}, {
  title: "Empresas",
  url: "/admin/empresas",
  icon: Building2
}, {
  title: "Configurações",
  url: "/admin/configuracoes",
  icon: Settings,
  masterAdminOnly: true
}];
const financeiroItems = [{
  title: "Financeiro",
  url: "/admin/financeiro",
  icon: Receipt
}];
const clienteItems = [{
  title: "Painel",
  url: "/cliente/dashboard",
  icon: Upload
}, {
  title: "Minha Equipe",
  url: "/cliente/minha-equipe",
  icon: Users
}, {
  title: "Histórico",
  url: "/cliente/historico",
  icon: History
}];
export function AppSidebar() {
  const {
    state
  } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    isMasterAdmin,
    isAdmin,
    isOperacional,
    isCliente,
    isFinanceiro,
    isAdminOrOperacional,
    empresaAtiva,
    hasMultipleEmpresas
  } = useUserRole();
  const {
    signOut
  } = useAuth();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";
  const [editarPerfilOpen, setEditarPerfilOpen] = useState(false);
  const items = isFinanceiro ? financeiroItems : isAdminOrOperacional ? adminItems.filter(item => {
    if ((item as any).masterAdminOnly) {
      return isMasterAdmin;
    }
    if (item.adminOrFinanceiro) {
      return isAdmin || isFinanceiro;
    }
    return true;
  }) : clienteItems;
  const handleTrocarEmpresa = () => {
    navigate("/cliente/selecionar-empresa");
  };
  return <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className={`border-b border-sidebar-border py-4 ${collapsed ? 'px-0' : 'px-4'}`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          {collapsed ?
        // Logo VV minimalista quando colapsado - centralizado
        <div className="flex items-center justify-center w-full">
              <img alt="VV" className="h-6 w-auto object-contain" src="/lovable-uploads/b835bced-c76e-4899-855c-4a4442f7f5bc.png" />
            </div> :
        // Logo completo quando expandido
        <div className="flex items-center gap-3">
              <div className="bg-white rounded-xl p-2 shadow-sm mx-[60px]">
                <img src={logoVV} alt="VV Benefícios" className="h-8 w-auto object-contain" />
              </div>
              <div className="min-w-0">
                
                {isCliente && empresaAtiva}
              </div>
            </div>}
        </div>
      </SidebarHeader>

      <SidebarContent className={`py-4 ${collapsed ? 'px-0' : 'px-2'}`}>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs font-medium uppercase tracking-wider px-3 mb-2">
              {isAdminOrOperacional ? "Administração" : isFinanceiro ? "Financeiro" : "Navegação"}
            </SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {items.map(item => <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={`flex items-center gap-3 py-2.5 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200 ${collapsed ? 'justify-center px-0 mx-auto w-10' : 'px-3'}`} activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm">
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={`border-t border-sidebar-border py-4 ${collapsed ? 'px-0' : 'px-4'}`}>
        <div className={`space-y-1.5 ${collapsed ? 'flex flex-col items-center' : ''}`}>
          {isCliente && hasMultipleEmpresas && <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleTrocarEmpresa} className={`text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground ${collapsed ? 'w-10 h-10' : 'w-full justify-start px-3'}`}>
                    <ArrowLeftRight className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="ml-2 text-sm">Trocar Empresa</span>}
                  </Button>
                </TooltipTrigger>
                {collapsed && <TooltipContent side="right">
                    Trocar Empresa
                  </TooltipContent>}
              </Tooltip>
            </TooltipProvider>}
          {isCliente && <Button variant="ghost" size="icon" onClick={() => setEditarPerfilOpen(true)} className={`text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground ${collapsed ? 'w-10 h-10' : 'w-full justify-start px-3'}`}>
              <UserCog className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="ml-2 text-sm">Editar Perfil</span>}
            </Button>}
          <Button variant="ghost" size="icon" onClick={signOut} className={`text-sidebar-foreground/80 hover:bg-destructive/20 hover:text-destructive ${collapsed ? 'w-10 h-10' : 'w-full justify-start px-3'}`}>
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="ml-2 text-sm">Sair</span>}
          </Button>
        </div>
      </SidebarFooter>

      {isCliente && <EditarPerfilDialog open={editarPerfilOpen} onOpenChange={setEditarPerfilOpen} />}
    </Sidebar>;
}