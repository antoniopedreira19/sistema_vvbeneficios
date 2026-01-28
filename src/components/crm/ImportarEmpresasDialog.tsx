import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Upload, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ImportarEmpresasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface EmpresaRow {
  nome: string;
  cnpj: string;
  email_contato: string;
  telefone: string;
}

interface ImportError {
  linha: number;
  campo: string;
  valor: string;
  erro: string;
}

const TEMPLATE_COLUMNS = ["nome", "cnpj", "email_contato", "telefone"];

// Validar CNPJ (formato e dígitos)
const isValidCNPJ = (cnpj: string): boolean => {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return false;
  
  // Verificar se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cleaned)) return false;
  
  return true;
};

// Validar email
const isValidEmail = (email: string): boolean => {
  if (!email) return true; // opcional
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Limpar CNPJ
const cleanCNPJ = (cnpj: string): string => {
  return cnpj.replace(/\D/g, "");
};

export function ImportarEmpresasDialog({ open, onOpenChange, onSuccess }: ImportarEmpresasDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [validRows, setValidRows] = useState<EmpresaRow[]>([]);
  const [step, setStep] = useState<"upload" | "review" | "importing">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const templateData = [
      { nome: "Empresa Exemplo LTDA", cnpj: "12345678000190", email_contato: "contato@empresa.com", telefone: "(11) 99999-9999" },
    ];
    
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws["!cols"] = [{ wch: 35 }, { wch: 18 }, { wch: 30 }, { wch: 18 }];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    XLSX.writeFile(wb, "modelo_importacao_empresas.xlsx");
    
    toast.success("Modelo baixado com sucesso!");
  };

  const processFile = async (selectedFile: File) => {
    setIsProcessing(true);
    setErrors([]);
    setValidRows([]);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

      if (jsonData.length === 0) {
        toast.error("Arquivo vazio ou sem dados válidos.");
        setIsProcessing(false);
        return;
      }

      const importErrors: ImportError[] = [];
      const validData: EmpresaRow[] = [];

      // Buscar CNPJs existentes para verificar duplicatas
      const { data: existingEmpresas } = await supabase
        .from("empresas")
        .select("cnpj");
      
      const existingCNPJs = new Set((existingEmpresas || []).map(e => cleanCNPJ(e.cnpj)));

      jsonData.forEach((row, index) => {
        const linha = index + 2; // +2 porque linha 1 é cabeçalho
        const nome = String(row.nome || "").trim();
        const cnpj = String(row.cnpj || "").trim();
        const email_contato = String(row.email_contato || "").trim();
        const telefone = String(row.telefone || "").trim();

        let hasError = false;

        // Validar nome (obrigatório)
        if (!nome) {
          importErrors.push({ linha, campo: "nome", valor: nome, erro: "Nome é obrigatório" });
          hasError = true;
        }

        // Validar CNPJ (obrigatório e formato)
        if (!cnpj) {
          importErrors.push({ linha, campo: "cnpj", valor: cnpj, erro: "CNPJ é obrigatório" });
          hasError = true;
        } else {
          const cleanedCNPJ = cleanCNPJ(cnpj);
          if (!isValidCNPJ(cnpj)) {
            importErrors.push({ linha, campo: "cnpj", valor: cnpj, erro: "CNPJ inválido (deve ter 14 dígitos)" });
            hasError = true;
          } else if (existingCNPJs.has(cleanedCNPJ)) {
            importErrors.push({ linha, campo: "cnpj", valor: cnpj, erro: "CNPJ já cadastrado no sistema" });
            hasError = true;
          }
        }

        // Validar email (opcional mas deve ser válido se preenchido)
        if (email_contato && !isValidEmail(email_contato)) {
          importErrors.push({ linha, campo: "email_contato", valor: email_contato, erro: "Email inválido" });
          hasError = true;
        }

        if (!hasError) {
          validData.push({
            nome,
            cnpj: cleanCNPJ(cnpj),
            email_contato: email_contato || null,
            telefone: telefone || null,
          } as EmpresaRow);
        }
      });

      setErrors(importErrors);
      setValidRows(validData);
      setStep("review");
    } catch (error: any) {
      console.error("Erro ao processar arquivo:", error);
      toast.error("Erro ao processar arquivo: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      processFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (validRows.length === 0) {
      toast.error("Nenhuma empresa válida para importar.");
      return;
    }

    setStep("importing");

    try {
      const empresasToInsert = validRows.map(row => ({
        nome: row.nome,
        cnpj: row.cnpj,
        email_contato: row.email_contato || null,
        telefone_contato: row.telefone || null,
        status: "sem_retorno" as const,
      }));

      const { error } = await supabase.from("empresas").insert(empresasToInsert);

      if (error) throw error;

      toast.success(`${validRows.length} empresa(s) importada(s) com sucesso!`);
      handleClose();
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao importar empresas:", error);
      toast.error("Erro ao importar: " + error.message);
      setStep("review");
    }
  };

  const handleClose = () => {
    setFile(null);
    setErrors([]);
    setValidRows([]);
    setStep("upload");
    if (fileInputRef.current) fileInputRef.current.value = "";
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Empresas</DialogTitle>
          <DialogDescription>
            Importe empresas a partir de um arquivo Excel (.xlsx). As empresas serão importadas com status "Sem Retorno".
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-6 py-4">
            {/* Download Template */}
            <div className="flex flex-col gap-2">
              <Label>1. Baixe o modelo</Label>
              <Button variant="outline" onClick={handleDownloadTemplate} className="w-fit">
                <Download className="mr-2 h-4 w-4" />
                Baixar Modelo
              </Button>
              <p className="text-xs text-muted-foreground">
                O modelo contém as colunas: nome, cnpj, email_contato, telefone
              </p>
            </div>

            {/* Upload File */}
            <div className="flex flex-col gap-2">
              <Label>2. Envie seu arquivo preenchido</Label>
              <div className="flex items-center gap-3">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={isProcessing}
                />
              </div>
              {isProcessing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processando arquivo...
                </div>
              )}
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4 py-4">
            {/* Summary */}
            <div className="flex gap-4">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-700">{validRows.length} válida(s)</span>
              </div>
              {errors.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="font-medium text-destructive">{errors.length} erro(s)</span>
                </div>
              )}
            </div>

            {/* Errors List */}
            {errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-2">Erros encontrados:</p>
                  <ScrollArea className="max-h-48">
                    <ul className="space-y-1 text-sm">
                      {errors.map((err, idx) => (
                        <li key={idx} className="flex gap-2">
                          <span className="font-mono text-xs bg-destructive/20 px-1 rounded">
                            Linha {err.linha}
                          </span>
                          <span>
                            {err.campo}: {err.erro}
                            {err.valor && <span className="text-muted-foreground"> ("{err.valor}")</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </AlertDescription>
              </Alert>
            )}

            {/* Valid Rows Preview */}
            {validRows.length > 0 && (
              <div className="border rounded-lg p-3">
                <p className="text-sm font-medium mb-2">Prévia das empresas válidas:</p>
                <ScrollArea className="max-h-40">
                  <ul className="space-y-1 text-sm">
                    {validRows.slice(0, 10).map((row, idx) => (
                      <li key={idx} className="text-muted-foreground">
                        {row.nome} - {row.cnpj}
                      </li>
                    ))}
                    {validRows.length > 10 && (
                      <li className="text-muted-foreground italic">
                        ... e mais {validRows.length - 10} empresa(s)
                      </li>
                    )}
                  </ul>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Importando empresas...</p>
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          )}
          {step === "review" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={validRows.length === 0}>
                <Upload className="mr-2 h-4 w-4" />
                Importar {validRows.length} empresa(s)
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
