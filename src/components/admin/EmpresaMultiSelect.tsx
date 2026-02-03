import { useState, useEffect } from "react";
import { Check, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
}

interface EmpresaMultiSelectProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  disabled?: boolean;
}

export function EmpresaMultiSelect({ 
  selectedIds, 
  onChange, 
  label = "Empresas",
  disabled = false 
}: EmpresaMultiSelectProps) {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchEmpresas = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, cnpj")
        .order("nome");
      
      if (data && !error) {
        setEmpresas(data);
      }
      setLoading(false);
    };

    fetchEmpresas();
  }, []);

  const filteredEmpresas = empresas.filter(emp => 
    emp.nome.toLowerCase().includes(search.toLowerCase()) ||
    emp.cnpj.includes(search)
  );

  const handleToggle = (empresaId: string) => {
    if (disabled) return;
    
    if (selectedIds.includes(empresaId)) {
      onChange(selectedIds.filter(id => id !== empresaId));
    } else {
      onChange([...selectedIds, empresaId]);
    }
  };

  const handleSelectAll = () => {
    if (disabled) return;
    if (selectedIds.length === filteredEmpresas.length) {
      onChange([]);
    } else {
      onChange(filteredEmpresas.map(e => e.id));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-xs text-muted-foreground">
          {selectedIds.length} selecionada{selectedIds.length !== 1 ? 's' : ''}
        </span>
      </div>
      
      <div className="border rounded-lg overflow-hidden">
        <div className="p-2 border-b bg-muted/30">
          <Input
            placeholder="Buscar empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
            disabled={disabled}
          />
        </div>
        
        {!loading && filteredEmpresas.length > 0 && (
          <div className="px-3 py-2 border-b bg-muted/20 flex items-center justify-between">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs text-primary hover:underline disabled:opacity-50"
              disabled={disabled}
            >
              {selectedIds.length === filteredEmpresas.length ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
          </div>
        )}
        
        <ScrollArea className="h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
            </div>
          ) : filteredEmpresas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Building2 className="h-8 w-8 mb-2 opacity-50" />
              <span className="text-sm">Nenhuma empresa encontrada</span>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredEmpresas.map((empresa) => {
                const isSelected = selectedIds.includes(empresa.id);
                return (
                  <div
                    key={empresa.id}
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    onClick={() => handleToggle(empresa.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggle(empresa.id);
                      }
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors cursor-pointer",
                      isSelected 
                        ? "bg-primary/10 border border-primary/30" 
                        : "hover:bg-muted/50 border border-transparent",
                      disabled && "opacity-50 cursor-not-allowed pointer-events-none"
                    )}
                  >
                    <div className={cn(
                      "h-4 w-4 shrink-0 rounded-sm border flex items-center justify-center",
                      isSelected 
                        ? "bg-primary border-primary text-primary-foreground" 
                        : "border-input"
                    )}>
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {empresa.nome}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {empresa.cnpj?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
