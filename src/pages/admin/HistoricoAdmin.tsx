import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  History,
  Search,
  Download,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
  MoreHorizontal,
  FileText,
  CreditCard,
  FileSpreadsheet,
  PackageOpen,
} from "lucide-react";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { formatCNPJ, formatCPF } from "@/lib/validators";
import { Checkbox } from "@/components/ui/checkbox";
import { EscolherModeloPlanilhaDialog, ModeloPlanilha } from "@/components/admin/operacional/EscolherModeloPlanilhaDialog";

interface LoteFaturado {
  id: string;
  competencia: string;
  total_colaboradores: number;
  total_reprovados: number;
  total_aprovados: number;
  valor_total: number;
  created_at: string;
  empresa_id: string;
  empresa: { nome: string; cnpj: string } | null;
  obra: { id: string; nome: string } | null;
  boleto_url: string | null;
}

const ITEMS_PER_PAGE = 100;

// Gerar competências para o filtro (últimos 12 meses + próximos 6)
const gerarCompetencias = (): string[] => {
  const competencias: string[] = [];
  const hoje = new Date();
  
  for (let i = -12; i <= 6; i++) {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    const mes = data.toLocaleString("pt-BR", { month: "long" });
    const mesCapitalizado = mes.charAt(0).toUpperCase() + mes.slice(1);
    const ano = data.getFullYear(); // Ano completo (2025, 2026)
    competencias.push(`${mesCapitalizado}/${ano}`);
  }
  
  return competencias;
};

export default function HistoricoAdmin() {
  const [searchTerm, setSearchTerm] = useState("");
  const [competenciaFilter, setCompetenciaFilter] = useState<string>("todas");
  const [sortBy, setSortBy] = useState<"alfabetica" | "recente">("recente");
  const [currentPage, setCurrentPage] = useState(1);
  const [modeloPlanilhaDialogOpen, setModeloPlanilhaDialogOpen] = useState(false);
  const [loteParaDownload, setLoteParaDownload] = useState<LoteFaturado | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloadModoMassa, setDownloadModoMassa] = useState(false);
  const [baixandoMassa, setBaixandoMassa] = useState(false);

  const competencias = gerarCompetencias();

  const { data: lotes = [], isLoading } = useQuery({
    queryKey: ["lotes-faturados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotes_mensais")
        .select(`
          id, competencia, total_colaboradores, total_reprovados, total_aprovados, 
          valor_total, created_at, empresa_id, boleto_url,
          empresa:empresas(nome, cnpj),
          obra:obras(id, nome)
        `)
        .eq("status", "faturado")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as LoteFaturado[];
    },
  });

  // Buscar notas fiscais para verificar se foram emitidas
  const { data: notasFiscais = [] } = useQuery({
    queryKey: ["notas-fiscais-historico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select("lote_id, nf_emitida, nf_url, boleto_gerado, boleto_url, pago");

      if (error) throw error;
      return data;
    },
  });

  const notasMap = new Map(notasFiscais.map((nf) => [nf.lote_id, nf]));

  // Filtrar e ordenar
  const filteredLotes = lotes
    .filter((l) => {
      const matchSearch = l.empresa?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCompetencia = competenciaFilter === "todas" || l.competencia === competenciaFilter;
      return matchSearch && matchCompetencia;
    })
    .sort((a, b) => {
      if (sortBy === "alfabetica") {
        return (a.empresa?.nome || "").localeCompare(b.empresa?.nome || "");
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // Paginação
  const totalPages = Math.ceil(filteredLotes.length / ITEMS_PER_PAGE);
  const paginatedLotes = filteredLotes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Abrir dialog para escolher modelo
  const handleDownloadClick = (lote: LoteFaturado) => {
    setLoteParaDownload(lote);
    setDownloadModoMassa(false);
    setModeloPlanilhaDialogOpen(true);
  };

  const handleBaixarEmMassaClick = () => {
    if (selectedIds.size === 0) return;
    setDownloadModoMassa(true);
    setLoteParaDownload(null);
    setModeloPlanilhaDialogOpen(true);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLotes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLotes.map((l) => l.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Buscar itens do lote (reutilizado por ambos modelos)
  const fetchItensLote = async (loteId: string) => {
    const { data: itens, error } = await supabase
      .from("colaboradores_lote")
      .select("nome, sexo, cpf, data_nascimento, salario, classificacao_salario, created_at")
      .eq("lote_id", loteId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!itens || itens.length === 0) return null;

    const cpfsProcessados = new Set<string>();
    const itensUnicos = itens.filter((item) => {
      const cpfLimpo = item.cpf.replace(/\D/g, "");
      if (cpfsProcessados.has(cpfLimpo)) return false;
      cpfsProcessados.add(cpfLimpo);
      return true;
    });
    itensUnicos.sort((a, b) => a.nome.localeCompare(b.nome));
    return itensUnicos;
  };

  const fetchCnpj = async (lote: LoteFaturado) => {
    let cnpj = lote.empresa?.cnpj || "";
    if (!cnpj && lote.empresa_id) {
      const { data: emp } = await supabase
        .from("empresas")
        .select("cnpj")
        .eq("id", lote.empresa_id)
        .single();
      if (emp) cnpj = emp.cnpj;
    }
    return cnpj.replace(/\D/g, "");
  };

  const parseDateString = (dateStr: string | null) => {
    if (!dateStr) return null;
    const parts = dateStr.split("-");
    if (parts.length === 3)
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return null;
  };

  const downloadBuffer = (buffer: ArrayBuffer, filename: string) => {
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleModeloSelecionado = async (modelo: ModeloPlanilha) => {
    if (downloadModoMassa) {
      setBaixandoMassa(true);
      toast.info("Iniciando geração do ZIP...");
      try {
        const zip = new JSZip();
        const lotesParaBaixar = filteredLotes.filter((l) => selectedIds.has(l.id));
        let processados = 0;

        for (const lote of lotesParaBaixar) {
          try {
            const itensUnicos = await fetchItensLote(lote.id);
            if (!itensUnicos || itensUnicos.length === 0) continue;

            const workbook = new ExcelJS.Workbook();
            if (modelo === "padrao_alba") {
              const cnpj = await fetchCnpj(lote);
              const ws = workbook.addWorksheet("Relação de Vidas");
              const headers = ["NOME", "SEXO", "CPF", "DATA NASCIMENTO", "SALARIO", "CLASSIFICACAO SALARIAL", "CNPJ"];
              const hr = ws.addRow(headers);
              ws.columns = headers.map(() => ({ width: 37.11 }));
              hr.eachCell((cell) => {
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF203455" } };
                cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
                cell.alignment = { horizontal: "center" };
              });
              itensUnicos.forEach((c) => {
                const d = parseDateString(c.data_nascimento);
                const row = ws.addRow([c.nome?.toUpperCase() || "", c.sexo || "Masculino", c.cpf ? formatCPF(c.cpf) : "", d, c.salario ? Number(c.salario) : 0, c.classificacao_salario || "", formatCNPJ(cnpj)]);
                if (d) row.getCell(4).numFmt = "dd/mm/yyyy";
                row.getCell(5).numFmt = "#,##0.00";
              });
            } else {
              const plano = `SINTEPAV-${lote.empresa?.nome || "EMPRESA"}`;
              const expiracao = new Date(2040, 0, 1);
              const ws = workbook.addWorksheet("Relação de Vidas");
              const headers = ["NOME", "CPF", "PLANO", "DATA NASCIMENTO", "EXPIRAÇÃO"];
              const hr = ws.addRow(headers);
              ws.columns = headers.map(() => ({ width: 37.11 }));
              hr.eachCell((cell) => {
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF203455" } };
                cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
                cell.alignment = { horizontal: "center" };
              });
              itensUnicos.forEach((c) => {
                const d = parseDateString(c.data_nascimento);
                const row = ws.addRow([c.nome?.toUpperCase() || "", c.cpf ? formatCPF(c.cpf) : "", plano, d, expiracao]);
                if (d) row.getCell(4).numFmt = "dd/mm/yyyy";
                row.getCell(5).numFmt = "dd/mm/yyyy";
              });
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const nomeEmpresa = (lote.empresa?.nome || "EMPRESA").replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
            zip.file(`HISTORICO_${nomeEmpresa}_${lote.competencia.replace("/", "-")}.xlsx`, buffer);
            processados++;
          } catch (err) {
            console.error(`Erro ao gerar arquivo para lote ${lote.id}`, err);
          }
        }

        if (processados === 0) { toast.warning("Nenhum arquivo válido gerado."); return; }
        const zipContent = await zip.generateAsync({ type: "blob" });
        const url = window.URL.createObjectURL(zipContent);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Historico_Lotes_${new Date().getTime()}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(`${processados} arquivos baixados em ZIP!`);
      } catch (error: any) {
        console.error(error);
        toast.error("Erro ao gerar ZIP: " + error.message);
      } finally {
        setBaixandoMassa(false);
      }
      return;
    }

    if (!loteParaDownload) return;
    const lote = loteParaDownload;

    try {
      toast.info("Preparando download...");
      const itensUnicos = await fetchItensLote(lote.id);
      if (!itensUnicos) {
        toast.warning("Não há colaboradores neste lote para baixar.");
        return;
      }

      const workbook = new ExcelJS.Workbook();

      if (modelo === "padrao_alba") {
        const cnpj = await fetchCnpj(lote);
        const worksheet = workbook.addWorksheet("Relação de Vidas");
        const headers = ["NOME", "SEXO", "CPF", "DATA NASCIMENTO", "SALARIO", "CLASSIFICACAO SALARIAL", "CNPJ"];
        const headerRow = worksheet.addRow(headers);
        worksheet.columns = headers.map(() => ({ width: 37.11 }));
        headerRow.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF203455" } };
          cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
          cell.alignment = { horizontal: "center" };
        });
        itensUnicos.forEach((c) => {
          const dataNascDate = parseDateString(c.data_nascimento);
          const row = worksheet.addRow([
            c.nome ? c.nome.toUpperCase() : "",
            c.sexo || "Masculino",
            c.cpf ? formatCPF(c.cpf) : "",
            dataNascDate,
            c.salario ? Number(c.salario) : 0,
            c.classificacao_salario || "",
            formatCNPJ(cnpj),
          ]);
          if (dataNascDate) row.getCell(4).numFmt = "dd/mm/yyyy";
          row.getCell(5).numFmt = "#,##0.00";
        });
      } else {
        const plano = `SINTEPAV-${lote.empresa?.nome || "EMPRESA"}`;
        const expiracao = new Date(2040, 0, 1);
        const worksheet = workbook.addWorksheet("Relação de Vidas");
        const headers = ["NOME", "CPF", "PLANO", "DATA NASCIMENTO", "EXPIRAÇÃO"];
        const headerRow = worksheet.addRow(headers);
        worksheet.columns = headers.map(() => ({ width: 37.11 }));
        headerRow.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF203455" } };
          cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
          cell.alignment = { horizontal: "center" };
        });
        itensUnicos.forEach((c) => {
          const dataNascDate = parseDateString(c.data_nascimento);
          const row = worksheet.addRow([
            c.nome ? c.nome.toUpperCase() : "",
            c.cpf ? formatCPF(c.cpf) : "",
            plano,
            dataNascDate,
            expiracao,
          ]);
          if (dataNascDate) row.getCell(4).numFmt = "dd/mm/yyyy";
          row.getCell(5).numFmt = "dd/mm/yyyy";
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `HISTORICO_${lote.empresa?.nome.replace(/[^a-zA-Z0-9]/g, "")}_${lote.competencia.replace("/", "-")}.xlsx`;
      downloadBuffer(buffer as ArrayBuffer, filename);
      toast.success("Download concluído.");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao gerar planilha: " + e.message);
    }
  };

  const handleExportarTabela = async () => {
    try {
      toast.info("Preparando exportação...");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Histórico");
      const headers = ["EMPRESA", "OBRA", "COMPETÊNCIA", "VIDAS", "VALOR", "NF EMITIDA", "BOLETO GERADO", "PAGO"];
      const headerRow = worksheet.addRow(headers);
      worksheet.columns = [
        { width: 40 }, { width: 30 }, { width: 20 }, { width: 10 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 10 },
      ];
      headerRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF203455" } };
        cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
        cell.alignment = { horizontal: "center" };
      });
      filteredLotes.forEach((lote) => {
        const vidas = (lote.total_colaboradores || 0) - (lote.total_reprovados || 0);
        const nota = notasMap.get(lote.id);
        const nfEmitida = nota?.nf_emitida || false;
        const boletoUrl = nota?.boleto_url || lote.boleto_url || null;
        const boletoGerado = !!(nota?.boleto_gerado || boletoUrl);
        const pago = nota?.pago || false;
        worksheet.addRow([
          lote.empresa?.nome || "-",
          lote.obra?.nome || "-",
          lote.competencia,
          vidas,
          lote.valor_total || 0,
          nfEmitida ? "Sim" : "Não",
          boletoGerado ? "Sim" : "Não",
          pago ? "Sim" : "Não",
        ]);
      });
      const buffer = await workbook.xlsx.writeBuffer();
      downloadBuffer(buffer as ArrayBuffer, `HISTORICO_LOTES_FATURADOS.xlsx`);
      toast.success("Exportação concluída.");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao exportar: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <History className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Histórico</h1>
            <p className="text-muted-foreground">Lotes faturados</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <Button variant="outline" onClick={handleExportarTabela} disabled={filteredLotes.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar XLSX
          </Button>
          <Button
            variant="outline"
            onClick={handleBaixarEmMassaClick}
            disabled={selectedIds.size === 0 || baixandoMassa}
          >
            <PackageOpen className="h-4 w-4 mr-2" />
            {baixandoMassa ? "Gerando..." : `Baixar Selecionados (${selectedIds.size})`}
          </Button>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por empresa..."
              className="pl-8 bg-background"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <Select
            value={competenciaFilter}
            onValueChange={(v) => {
              setCompetenciaFilter(v);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-full md:w-[180px] bg-background">
              <SelectValue placeholder="Competência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as competências</SelectItem>
              {competencias.map((comp) => (
                <SelectItem key={comp} value={comp}>
                  {comp}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as "alfabetica" | "recente")}>
            <SelectTrigger className="w-full md:w-[180px] bg-background">
              <ArrowUpDown className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alfabetica">Ordem Alfabética</SelectItem>
              <SelectItem value="recente">Mais Recentes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5 text-primary" />
            Lotes Faturados ({filteredLotes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : paginatedLotes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum lote faturado encontrado
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                   <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filteredLotes.length > 0 && selectedIds.size === filteredLotes.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead className="text-center">Vidas</TableHead>
                    <TableHead className="text-center">Valor</TableHead>
                     <TableHead className="text-center">NF Emitida</TableHead>
                     <TableHead className="text-center">Boleto Gerado</TableHead>
                     <TableHead className="text-center">Pago</TableHead>
                     <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLotes.map((lote) => {
                    const vidas = (lote.total_colaboradores || 0) - (lote.total_reprovados || 0);
                    const nota = notasMap.get(lote.id);
                    const nfEmitida = nota?.nf_emitida || false;
                    const boletoUrl = nota?.boleto_url || lote.boleto_url || null;
                    const boletoGerado = !!(nota?.boleto_gerado || boletoUrl);
                    const nfUrl = nota?.nf_url || null;
                    const pago = nota?.pago || false;

                    return (
                      <TableRow key={lote.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(lote.id)}
                            onCheckedChange={() => toggleSelect(lote.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div>{lote.empresa?.nome || "-"}</div>
                          {lote.obra?.nome && (
                            <div className="text-xs text-muted-foreground">{lote.obra.nome}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{lote.competencia}</Badge>
                        </TableCell>
                        <TableCell className="text-center">{vidas}</TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          R$ {(lote.valor_total || 0).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-center">
                          {nfEmitida ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                          ) : (
                            <XCircle className="h-5 w-5 text-muted-foreground mx-auto" />
                          )}
                         </TableCell>
                         <TableCell className="text-center">
                           {boletoGerado ? (
                             <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                           ) : (
                             <XCircle className="h-5 w-5 text-muted-foreground mx-auto" />
                           )}
                         </TableCell>
                         <TableCell className="text-center">
                           {pago ? (
                             <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                           ) : (
                             <XCircle className="h-5 w-5 text-muted-foreground mx-auto" />
                           )}
                         </TableCell>
                         <TableCell className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem onClick={() => handleDownloadClick(lote)}>
                                <FileSpreadsheet className="h-4 w-4 mr-2" />
                                Baixar Planilha
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {boletoUrl ? (
                                <DropdownMenuItem onClick={() => window.open(boletoUrl, "_blank")}>
                                  <CreditCard className="h-4 w-4 mr-2" />
                                  Ver Boleto
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem disabled className="text-muted-foreground">
                                  <CreditCard className="h-4 w-4 mr-2" />
                                  Boleto não disponível
                                </DropdownMenuItem>
                              )}
                              {nfUrl ? (
                                <DropdownMenuItem onClick={() => window.open(nfUrl, "_blank")}>
                                  <FileText className="h-4 w-4 mr-2" />
                                  Ver Nota Fiscal
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem disabled className="text-muted-foreground">
                                  <FileText className="h-4 w-4 mr-2" />
                                  NF não disponível
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <EscolherModeloPlanilhaDialog
        open={modeloPlanilhaDialogOpen}
        onOpenChange={setModeloPlanilhaDialogOpen}
        onSelect={handleModeloSelecionado}
      />
    </div>
  );
}
