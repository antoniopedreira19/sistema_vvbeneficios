import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Loader2 } from "lucide-react";

export type ModeloPlanilha = "padrao_alba" | "padrao_clube";

interface EscolherModeloPlanilhaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (modelo: ModeloPlanilha) => Promise<void>;
}

export function EscolherModeloPlanilhaDialog({
  open,
  onOpenChange,
  onSelect,
}: EscolherModeloPlanilhaDialogProps) {
  const [loading, setLoading] = useState<ModeloPlanilha | null>(null);

  const handleSelect = async (modelo: ModeloPlanilha) => {
    setLoading(modelo);
    try {
      await onSelect(modelo);
    } finally {
      setLoading(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Escolher Modelo da Planilha
          </DialogTitle>
          <DialogDescription>
            Selecione o formato de exportação desejado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-4">
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-start gap-1 text-left"
            disabled={!!loading}
            onClick={() => handleSelect("padrao_alba")}
          >
            <div className="flex items-center gap-2 w-full">
              {loading === "padrao_alba" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 text-primary" />
              )}
              <span className="font-semibold">Padrão Alba</span>
            </div>
            <span className="text-xs text-muted-foreground">
              Nome, Sexo, CPF, Data Nascimento, Salário, Classificação, CNPJ
            </span>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-start gap-1 text-left"
            disabled={!!loading}
            onClick={() => handleSelect("padrao_clube")}
          >
            <div className="flex items-center gap-2 w-full">
              {loading === "padrao_clube" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 text-primary" />
              )}
              <span className="font-semibold">Padrão Clube</span>
            </div>
            <span className="text-xs text-muted-foreground">
              Nome, CPF, Plano, Data de Nascimento, Expiração
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
