import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Trash2, Plus, Save, X, Pencil, Upload, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatCPF, validateCPF } from "@/lib/validators";
import { LoteOperacional } from "./LotesTable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";

interface EditarLoteDialogProps {
  lote: LoteOperacional;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Helpers de normalização
const normalizarHeader = (h: string) =>
  h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const normalizarSexo = (valor: any): string => {
  if (!valor) return "Masculino";
  const str = String(valor).trim().toLowerCase();
  if (["masculino", "masc", "m"].includes(str)) return "Masculino";
  if (["feminino", "fem", "f"].includes(str)) return "Feminino";
  return "Masculino";
};

const normalizarSalario = (valor: any): number => {
  if (!valor) return 0;
  if (typeof valor === "number") return valor;
  let str = String(valor).replace(/R\$/g, "").replace(/\s/g, "").trim();
  if (str.includes(",")) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (str.includes(".")) {
    const parts = str.split(".");
    if (parts.length === 2 && parts[1].length === 3) {
      str = str.replace(/\./g, "");
    }
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

const normalizarData = (valor: any): string => {
  if (!valor) return "2000-01-01";
  const str = String(valor).trim();
  const ddmmyyyy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, "0");
    const month = ddmmyyyy[2].padStart(2, "0");
    let year = ddmmyyyy[3];
    if (year.length === 2) {
      year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
    } else if (year.length === 3) {
      return "2000-01-01";
    }
    return `${year}-${month}-${day}`;
  }
  if (!isNaN(Number(valor))) {
    const excelDate = XLSX.SSF.parse_date_code(Number(valor));
    if (excelDate && excelDate.y >= 1900 && excelDate.y <= 2100) {
      return `${excelDate.y}-${String(excelDate.m).padStart(2, "0")}-${String(excelDate.d).padStart(2, "0")}`;
    }
  }
  const yyyymmdd = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmdd) return str;
  return "2000-01-01";
};

const calcularClassificacao = (salario: number) => {
  if (salario < 2000) return "Ajudante";
  return "Profissional";
};

export function EditarLoteDialog({ lote, open, onOpenChange }: EditarLoteDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [replacingLoading, setReplacingLoading] = useState(false);
  const [importErrors, setImportErrors] = useState<{ linha: number; campo: string; erro: string }[]>([]);
  const [importValidCount, setImportValidCount] = useState(0);
  const [importStep, setImportStep] = useState<"upload" | "review">("upload");
  const [pendingImportData, setPendingImportData] = useState<any[] | null>(null);
  const [pendingDesligarIds, setPendingDesligarIds] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    nome: "",
    cpf: "",
    sexo: "Masculino",
    data_nascimento: "",
    salario: "",
    classificacao_salario: "Ajudante Comum",
  });

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["itens-lote", lote.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores_lote")
        .select("*")
        .eq("lote_id", lote.id)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const resetForm = () => {
    setFormData({
      nome: "",
      cpf: "",
      sexo: "Masculino",
      data_nascimento: "",
      salario: "",
      classificacao_salario: "Ajudante Comum",
    });
    setEditingId(null);
    setIsAdding(false);
  };

  const handleEditClick = (item: any) => {
    setEditingId(item.id);
    setFormData({
      nome: item.nome,
      cpf: item.cpf,
      sexo: item.sexo || "Masculino",
      data_nascimento: item.data_nascimento || "",
      salario: item.salario?.toString() || "0",
      classificacao_salario: item.classificacao_salario || "Ajudante Comum",
    });
    setIsAdding(true);
  };

  // Processar arquivo para substituir lote (fase 1: validação)
  const handleFileReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReplacingLoading(true);
    setImportErrors([]);
    setImportValidCount(0);
    setPendingImportData(null);
    setPendingDesligarIds([]);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);

      let jsonData: any[][] = [];
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const tempJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: null }) as any[][];
        if (tempJson.length > 0) {
          for (let i = 0; i < Math.min(5, tempJson.length); i++) {
            const row = tempJson[i];
            const headers = row.map((h: any) => normalizarHeader(String(h || "")));
            const hasNome = headers.some((h) => ["nome", "funcionario", "colaborador"].some((n) => h.includes(n)));
            const hasCPF = headers.some((h) => ["cpf", "documento"].some((n) => h.includes(n)));
            if (hasNome && hasCPF) {
              jsonData = tempJson.slice(i);
              break;
            }
          }
          if (jsonData.length > 0) break;
        }
      }

      if (jsonData.length === 0) {
        toast.error("Colunas 'Nome' e 'CPF' não encontradas.");
        return;
      }

      const headers = jsonData[0].map((h: any) => normalizarHeader(String(h || "")));
      const idxNome = headers.findIndex((h) => ["nome", "funcionario", "colaborador"].some((n) => h.includes(n)));
      const idxCPF = headers.findIndex((h) => ["cpf", "documento"].some((n) => h.includes(n)));
      const idxSalario = headers.findIndex((h) => ["salario", "vencimento", "remuneracao"].some((n) => h.includes(n)));
      const idxNasc = headers.findIndex((h) => ["nascimento", "data", "dtnasc"].some((n) => h.includes(n)));
      const idxSexo = headers.findIndex((h) => ["sexo", "genero"].some((n) => h.includes(n)));

      const novosDados: any[] = [];
      const cpfsVistos = new Set<string>();
      const errors: { linha: number; campo: string; erro: string }[] = [];

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        const linha = i + 1; // linha na planilha (header = 1)
        const nome = row[idxNome] ? String(row[idxNome]).trim().toUpperCase() : "";
        const cpfRaw = row[idxCPF] ? String(row[idxCPF]) : "";
        const cpfLimpo = cpfRaw.replace(/\D/g, "").padStart(11, "0");
        const salario = idxSalario !== -1 ? normalizarSalario(row[idxSalario]) : 0;
        const dataNascRaw = idxNasc !== -1 ? row[idxNasc] : null;
        const dataNasc = idxNasc !== -1 ? normalizarData(dataNascRaw) : "2000-01-01";

        let hasError = false;

        // Validar nome
        if (!nome) {
          errors.push({ linha, campo: "Nome", erro: "Nome está vazio" });
          hasError = true;
        }

        // Validar CPF
        if (!cpfRaw || cpfLimpo.replace(/0/g, "").length === 0) {
          errors.push({ linha, campo: "CPF", erro: "CPF está vazio" });
          hasError = true;
        } else if (cpfLimpo.length !== 11) {
          errors.push({ linha, campo: "CPF", erro: `CPF inválido: "${cpfRaw}" (deve ter 11 dígitos)` });
          hasError = true;
        } else if (!validateCPF(cpfLimpo)) {
          errors.push({ linha, campo: "CPF", erro: `CPF inválido: "${formatCPF(cpfLimpo)}"` });
          hasError = true;
        } else if (cpfsVistos.has(cpfLimpo)) {
          errors.push({ linha, campo: "CPF", erro: `CPF duplicado na planilha: "${formatCPF(cpfLimpo)}"` });
          hasError = true;
        }

        // Validar data de nascimento
        if (idxNasc !== -1 && dataNascRaw) {
          if (dataNasc === "2000-01-01" && String(dataNascRaw).trim() !== "") {
            const rawStr = String(dataNascRaw).trim();
            // Check if it's actually meant to be 2000-01-01 or if normalization failed
            if (rawStr !== "01/01/2000" && rawStr !== "2000-01-01") {
              errors.push({ linha, campo: "Nascimento", erro: `Data inválida: "${rawStr}"` });
              hasError = true;
            }
          }
        }

        // Validar salário
        if (idxSalario !== -1 && salario <= 0 && row[idxSalario]) {
          errors.push({ linha, campo: "Salário", erro: `Valor inválido: "${row[idxSalario]}"` });
          hasError = true;
        }

        if (!hasError) {
          cpfsVistos.add(cpfLimpo);
          novosDados.push({
            nome,
            cpf: cpfLimpo,
            sexo: idxSexo !== -1 ? normalizarSexo(row[idxSexo]) : "Masculino",
            data_nascimento: dataNasc,
            salario,
            classificacao_salario: calcularClassificacao(salario),
          });
        }
      }

      // Buscar colaboradores ativos para calcular desligamentos
      const { data: colaboradoresAtuais } = await supabase
        .from("colaboradores")
        .select("id, cpf")
        .eq("empresa_id", lote.empresa_id)
        .eq("obra_id", lote.obra?.id)
        .eq("status", "ativo");

      const cpfsNaLista = new Set(novosDados.map((c) => c.cpf));
      const idsParaDesligar = (colaboradoresAtuais || [])
        .filter((c) => !cpfsNaLista.has(c.cpf))
        .map((c) => c.id);

      setImportErrors(errors);
      setImportValidCount(novosDados.length);
      setPendingImportData(novosDados);
      setPendingDesligarIds(idsParaDesligar);
      setImportStep("review");
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao processar arquivo: " + error.message);
    } finally {
      setReplacingLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Confirmar importação após revisão (fase 2)
  const confirmReplace = async () => {
    if (!pendingImportData || pendingImportData.length === 0) return;

    setReplacingLoading(true);
    try {
      // Deletar itens antigos do lote
      await supabase.from("colaboradores_lote").delete().eq("lote_id", lote.id);

      const BATCH_SIZE = 100;
      for (let i = 0; i < pendingImportData.length; i += BATCH_SIZE) {
        const batch = pendingImportData.slice(i, i + BATCH_SIZE);

        const mestraData = batch.map((c: any) => ({
          empresa_id: lote.empresa_id,
          obra_id: lote.obra?.id,
          nome: c.nome,
          cpf: c.cpf,
          sexo: c.sexo,
          data_nascimento: c.data_nascimento,
          salario: c.salario,
          classificacao_salario: c.classificacao_salario,
          status: "ativo" as const,
        }));

        const { data: upsertedCols, error: upsertError } = await supabase
          .from("colaboradores")
          .upsert(mestraData, { onConflict: "empresa_id, cpf", ignoreDuplicates: false })
          .select("id, cpf");

        if (upsertError) throw upsertError;

        const cpfToIdMap = new Map(upsertedCols?.map((c) => [c.cpf, c.id]));

        const loteItemsData = batch.map((c: any) => ({
          lote_id: lote.id,
          colaborador_id: cpfToIdMap.get(c.cpf),
          nome: c.nome,
          cpf: c.cpf,
          sexo: c.sexo,
          data_nascimento: c.data_nascimento,
          salario: c.salario,
          classificacao_salario: c.classificacao_salario,
          status_seguradora: "aprovado",
        }));

        await supabase.from("colaboradores_lote").insert(loteItemsData);
      }

      // Marcar colaboradores ausentes como desligados
      if (pendingDesligarIds.length > 0) {
        for (let i = 0; i < pendingDesligarIds.length; i += BATCH_SIZE) {
          const chunkIds = pendingDesligarIds.slice(i, i + BATCH_SIZE);
          await supabase
            .from("colaboradores")
            .update({ status: "desligado", updated_at: new Date().toISOString() })
            .in("id", chunkIds);
        }
      }

      // Atualizar totais do lote
      const valorTotal = pendingImportData.length * 50;
      await supabase
        .from("lotes_mensais")
        .update({
          total_colaboradores: pendingImportData.length,
          total_aprovados: pendingImportData.length,
          valor_total: valorTotal,
          updated_at: new Date().toISOString(),
        })
        .eq("id", lote.id);

      toast.success(`Lote substituído! ${pendingImportData.length} colaboradores. ${pendingDesligarIds.length} desligados.`);
      queryClient.invalidateQueries({ queryKey: ["itens-lote", lote.id] });
      queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] });
      setIsReplacing(false);
      setImportStep("upload");
      setPendingImportData(null);
      setImportErrors([]);
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao importar: " + error.message);
    } finally {
      setReplacingLoading(false);
    }
  };

  const upsertItemMutation = useMutation({
    mutationFn: async () => {
      if (!formData.nome || !formData.cpf) throw new Error("Nome e CPF obrigatórios");
      const cpfLimpo = formData.cpf.replace(/\D/g, "");

      const { data: masterData, error: masterError } = await supabase
        .from("colaboradores")
        .upsert(
          {
            empresa_id: lote.empresa_id,
            obra_id: lote.obra?.id,
            nome: formData.nome.toUpperCase(),
            cpf: cpfLimpo,
            sexo: formData.sexo,
            data_nascimento: formData.data_nascimento,
            salario: parseFloat(formData.salario),
            classificacao_salario: formData.classificacao_salario,
            status: "ativo",
          },
          { onConflict: "empresa_id, cpf" },
        )
        .select("id")
        .single();

      if (masterError) throw masterError;

      const colaboradorId = (masterData as any).id;

      if (editingId) {
        const { error } = await supabase
          .from("colaboradores_lote")
          .update({
            nome: formData.nome.toUpperCase(),
            cpf: cpfLimpo,
            sexo: formData.sexo,
            data_nascimento: formData.data_nascimento,
            salario: parseFloat(formData.salario),
            classificacao_salario: formData.classificacao_salario,
            colaborador_id: colaboradorId,
          })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("colaboradores_lote").insert({
          lote_id: lote.id,
          colaborador_id: colaboradorId,
          nome: formData.nome.toUpperCase(),
          cpf: cpfLimpo,
          sexo: formData.sexo,
          data_nascimento: formData.data_nascimento,
          salario: parseFloat(formData.salario),
          classificacao_salario: formData.classificacao_salario,
          status_seguradora: "aprovado",
        });
        if (error) throw error;
      }
      await atualizarTotaisLote();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itens-lote", lote.id] });
      toast.success(editingId ? "Colaborador atualizado" : "Colaborador adicionado");
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("colaboradores_lote").delete().eq("id", id);
      if (error) throw error;
      await atualizarTotaisLote();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itens-lote", lote.id] });
      toast.success("Colaborador removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteLoteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lotes_mensais").delete().eq("id", lote.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] });
      toast.success("Lote excluído");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const atualizarTotaisLote = async () => {
    const { count, error } = await supabase
      .from("colaboradores_lote")
      .select("*", { count: "exact", head: true })
      .eq("lote_id", lote.id);
    if (error) return;
    const novoTotal = count || 0;
    const novoValor = novoTotal * 50;
    await supabase
      .from("lotes_mensais")
      .update({ total_colaboradores: novoTotal, total_aprovados: novoTotal, valor_total: novoValor })
      .eq("id", lote.id);
    queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar Lote: {lote.empresa?.nome}</DialogTitle>
          <DialogDescription>
            Competência: {lote.competencia} | Total: {itens.length} colaboradores
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4 py-4">
          {/* Área de substituição por arquivo */}
          {isReplacing ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4 animate-in fade-in">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-blue-800">Substituir Lote por Nova Planilha</h4>
                <Button variant="ghost" size="sm" onClick={() => { setIsReplacing(false); setImportStep("upload"); setImportErrors([]); setPendingImportData(null); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {importStep === "upload" && (
                <>
                  <p className="text-sm text-blue-700">
                    O lote atual será substituído. Colaboradores ausentes na nova lista serão marcados como desligados.
                  </p>
                  <div
                    className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center cursor-pointer hover:bg-blue-100 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {replacingLoading ? (
                      <Loader2 className="mx-auto h-10 w-10 text-blue-500 animate-spin" />
                    ) : (
                      <>
                        <Upload className="mx-auto h-10 w-10 text-blue-500 mb-2" />
                        <p className="font-medium text-blue-800">Clique para selecionar arquivo (.xlsx)</p>
                      </>
                    )}
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx"
                      className="hidden"
                      onChange={handleFileReplace}
                      disabled={replacingLoading}
                    />
                  </div>
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        const templateData = [
                          {
                            "NOME": "EXEMPLO SILVA",
                            SEXO: "Masculino",
                            CPF: "12345678901",
                            "DATA NASCIMENTO": "01/01/1990",
                            SALARIO: "R$ 2.500,00",
                          },
                        ];
                        const ws = XLSX.utils.json_to_sheet(templateData);
                        ws["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 14 }];
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, "Modelo");
                        XLSX.writeFile(wb, "modelo_importacao.xlsx");
                      }}
                    >
                      <Download className="h-4 w-4" /> Baixar Modelo
                    </Button>
                  </div>
                </>
              )}

              {importStep === "review" && (
                <div className="space-y-4">
                  {/* Resumo */}
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-700">{importValidCount} válido(s)</span>
                    </div>
                    {importErrors.length > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        <span className="font-medium text-destructive">{importErrors.length} erro(s)</span>
                      </div>
                    )}
                    {pendingDesligarIds.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-amber-700">
                        ⚠ {pendingDesligarIds.length} será(ão) desligado(s)
                      </div>
                    )}
                  </div>

                  {/* Lista de erros */}
                  {importErrors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <p className="font-medium mb-2">Linhas com erro (não serão importadas):</p>
                        <ScrollArea className="max-h-48">
                          <ul className="space-y-1 text-sm">
                            {importErrors.map((err, idx) => (
                              <li key={idx} className="flex gap-2">
                                <span className="font-mono text-xs bg-destructive/20 px-1 rounded whitespace-nowrap">
                                  Linha {err.linha}
                                </span>
                                <span>
                                  {err.campo}: {err.erro}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </ScrollArea>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Ações */}
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => { setImportStep("upload"); setImportErrors([]); setPendingImportData(null); }}>
                      Trocar Arquivo
                    </Button>
                    <Button size="sm" onClick={confirmReplace} disabled={importValidCount === 0 || replacingLoading}>
                      {replacingLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                      Importar {importValidCount} colaborador(es)
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : !isAdding ? (
            <div className="flex justify-between items-center bg-muted/30 p-2 rounded-lg">
              <span className="text-sm font-medium ml-2">Lista de Colaboradores</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsReplacing(true)} className="gap-2">
                  <RefreshCw className="h-4 w-4" /> Trocar Arquivo
                </Button>
                <Button size="sm" onClick={() => setIsAdding(true)} className="gap-2">
                  <Plus className="h-4 w-4" /> Adicionar
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-muted/40 p-4 rounded-lg border space-y-4 animate-in fade-in">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-sm">{editingId ? "Editar" : "Novo"}</h4>
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label>Nome</Label>
                  <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>CPF</Label>
                  <Input
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
                    maxLength={14}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Nascimento</Label>
                  <Input
                    type="date"
                    value={formData.data_nascimento}
                    onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Sexo</Label>
                  <Select value={formData.sexo} onValueChange={(v) => setFormData({ ...formData, sexo: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Masculino">Masculino</SelectItem>
                      <SelectItem value="Feminino">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Salário</Label>
                  <Input
                    type="number"
                    value={formData.salario}
                    onChange={(e) => setFormData({ ...formData, salario: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Cargo</Label>
                  <Input
                    value={formData.classificacao_salario}
                    onChange={(e) => setFormData({ ...formData, classificacao_salario: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button onClick={() => upsertItemMutation.mutate()} disabled={upsertItemMutation.isPending}>
                  {upsertItemMutation.isPending ? (
                    <Loader2 className="animate-spin mr-2" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}{" "}
                  Salvar
                </Button>
              </div>
            </div>
          )}

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Nascimento</TableHead>
                  <TableHead>Salário</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : (
                  itens.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.nome}</TableCell>
                      <TableCell>{formatCPF(item.cpf)}</TableCell>
                      <TableCell>
                        {item.data_nascimento ? new Date(item.data_nascimento).toLocaleDateString("pt-BR") : "-"}
                      </TableCell>
                      <TableCell>R$ {item.salario?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEditClick(item)}>
                            <Pencil className="h-4 w-4 text-blue-500" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir?</AlertDialogTitle>
                                <AlertDialogDescription>Remover este colaborador do lote?</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteItemMutation.mutate(item.id)}
                                  className="bg-red-600"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter className="justify-between border-t pt-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                <Trash2 className="h-4 w-4" /> Excluir Lote
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir Lote?</AlertDialogTitle>
                <AlertDialogDescription>Isso apagará o lote e todos os itens.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteLoteMutation.mutate()} className="bg-red-600">
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
