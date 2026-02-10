import { useState } from "react";
import { 
  History, 
  Search, 
  Filter, 
  FileText, 
  Loader2,
  ChevronLeft,
  ChevronRight,
  Building2,
  Calendar,
  ExternalLink,
  Download,
  CreditCard
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCPF, formatCNPJ } from "@/lib/validators";
import ExcelJS from "exceljs";
import { toast } from "sonner";

import { useQueryClient } from "@tanstack/react-query";

const ITEMS_PER_PAGE = 10;

const Historico = () => {
  const { profile, loading: profileLoading } = useUserRole();
  const empresaId = profile?.empresa_id;
  const queryClient = useQueryClient();

  const [selectedObra, setSelectedObra] = useState("all");
  const [selectedCompetencia, setSelectedCompetencia] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [generatingBoletoId, setGeneratingBoletoId] = useState<string | null>(null);

  const handleGerarBoleto = async (loteId: string) => {
    setGeneratingBoletoId(loteId);
    try {
      const response = await fetch("https://grifoworkspace.app.n8n.cloud/webhook/gerar-boleto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loteId }),
      });
      if (!response.ok) throw new Error("Erro na requisição");
      toast.success("Boleto gerado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["historico-lotes"] });
      queryClient.invalidateQueries({ queryKey: ["notas-fiscais-cliente"] });
    } catch (error) {
      console.error("Erro ao gerar boleto:", error);
      toast.error("Erro ao gerar boleto. Tente novamente.");
    } finally {
      setGeneratingBoletoId(null);
    }
  };

  // Buscar obras da empresa
  const { data: obras, isLoading: obrasLoading } = useQuery({
    queryKey: ["obras-historico", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from("obras")
        .select("id, nome")
        .eq("empresa_id", empresaId)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  // Buscar competências disponíveis
  const { data: competencias } = useQuery({
    queryKey: ["competencias-historico", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from("lotes_mensais")
        .select("competencia")
        .eq("empresa_id", empresaId)
        .neq("status", "rascunho")
        .order("competencia", { ascending: false });
      if (error) throw error;
      // Remover duplicatas
      const uniqueCompetencias = [...new Set(data?.map(d => d.competencia) || [])];
      return uniqueCompetencias;
    },
    enabled: !!empresaId,
  });

  // Buscar lotes (histórico) com filtros e paginação
  const { data: lotesData, isLoading: lotesLoading } = useQuery({
    queryKey: ["historico-lotes", empresaId, selectedObra, selectedCompetencia, currentPage],
    queryFn: async () => {
      if (!empresaId) return { data: [], count: 0 };

      let query = supabase
        .from("lotes_mensais")
        .select("*, obras(nome)", { count: "exact" })
        .eq("empresa_id", empresaId)
        .neq("status", "rascunho");

      // Filtro por obra
      if (selectedObra !== "all") {
        query = query.eq("obra_id", selectedObra);
      }

      // Filtro por competência
      if (selectedCompetencia !== "all") {
        query = query.eq("competencia", selectedCompetencia);
      }

      // Paginação
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    enabled: !!empresaId,
  });

  // Buscar notas fiscais para os lotes
  const loteIds = lotesData?.data?.map((l: any) => l.id) || [];
  const { data: notasFiscais } = useQuery({
    queryKey: ["notas-fiscais-cliente", loteIds],
    queryFn: async () => {
      if (loteIds.length === 0) return [];
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select("lote_id, nf_emitida, nf_url, boleto_gerado, boleto_url")
        .in("lote_id", loteIds);
      if (error) throw error;
      return data || [];
    },
    enabled: loteIds.length > 0,
  });

  // Criar mapa de notas fiscais por lote_id
  const notasFiscaisMap = new Map(
    notasFiscais?.map((nf: any) => [nf.lote_id, nf]) || []
  );

  const lotes = lotesData?.data || [];
  const totalCount = lotesData?.count || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "concluido":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Concluído</Badge>;
      case "faturado":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Faturado</Badge>;
      case "aguardando_processamento":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Aguardando Processamento</Badge>;
      case "em_analise_seguradora":
        return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">Em Análise</Badge>;
      case "com_pendencia":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Com Pendência</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0,00";
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const handleDownloadLista = async (lote: any) => {
    try {
      toast.info("Preparando download...");

      const { data: itens, error } = await supabase
        .from("colaboradores_lote")
        .select("nome, sexo, cpf, data_nascimento, salario, classificacao_salario, created_at")
        .eq("lote_id", lote.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!itens || itens.length === 0) {
        toast.warning("Não há colaboradores neste lote para baixar.");
        return;
      }

      const cpfsProcessados = new Set<string>();
      const itensUnicos = itens.filter((item) => {
        const cpfLimpo = item.cpf.replace(/\D/g, "");
        if (cpfsProcessados.has(cpfLimpo)) return false;
        cpfsProcessados.add(cpfLimpo);
        return true;
      });

      itensUnicos.sort((a, b) => a.nome.localeCompare(b.nome));

      let cnpj = "";
      if (empresaId) {
        const { data: emp } = await supabase
          .from("empresas")
          .select("cnpj")
          .eq("id", empresaId)
          .single();
        if (emp) cnpj = emp.cnpj;
      }
      cnpj = cnpj.replace(/\D/g, "");

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Relação de Vidas");
      const headers = [
        "NOME",
        "SEXO",
        "CPF",
        "DATA NASCIMENTO",
        "SALARIO",
        "CLASSIFICACAO SALARIAL",
        "CNPJ",
      ];
      const headerRow = worksheet.addRow(headers);

      const COL_WIDTH = 37.11;
      worksheet.columns = headers.map(() => ({ width: COL_WIDTH }));

      headerRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF203455" } };
        cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
        cell.alignment = { horizontal: "center" };
      });

      itensUnicos.forEach((c) => {
        let dataNascDate: Date | null = null;
        if (c.data_nascimento) {
          const parts = c.data_nascimento.split("-");
          if (parts.length === 3)
            dataNascDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }

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

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `LISTA_${lote.competencia.replace("/", "-")}_${lote.obras?.nome?.replace(/[^a-zA-Z0-9]/g, "") || "geral"}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Download concluído.");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao gerar planilha: " + e.message);
    }
  };


  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <History className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Histórico</h1>
          <p className="text-muted-foreground">Listas enviadas e faturas anteriores</p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="sm:w-64">
              <Select 
                value={selectedCompetencia} 
                onValueChange={(value) => {
                  setSelectedCompetencia(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Filtrar por competência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Competências</SelectItem>
                  {competencias?.map((comp) => (
                    <SelectItem key={comp} value={comp}>
                      {comp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:w-64">
              <Select 
                value={selectedObra} 
                onValueChange={(value) => {
                  setSelectedObra(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Filtrar por obra" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Obras</SelectItem>
                  {obrasLoading ? (
                    <SelectItem value="loading" disabled>Carregando...</SelectItem>
                  ) : (
                    obras?.map((obra) => (
                      <SelectItem key={obra.id} value={obra.id}>
                        {obra.nome}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Listas Enviadas</CardTitle>
          <CardDescription>
            {totalCount} {totalCount === 1 ? "registro encontrado" : "registros encontrados"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lotesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competência</TableHead>
                    <TableHead>Obra</TableHead>
                    <TableHead>Vidas</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Enviado em</TableHead>
                    <TableHead>Status</TableHead>
                     <TableHead>NF Emitida</TableHead>
                     <TableHead>Anexo NF</TableHead>
                     <TableHead>Boleto Gerado</TableHead>
                     <TableHead>Anexo Boleto</TableHead>
                     <TableHead>Baixar Lista</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lotes.length > 0 ? (
                    lotes.map((lote: any) => {
                      const notaFiscal = notasFiscaisMap.get(lote.id);
                      return (
                        <TableRow key={lote.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="font-medium">{lote.competencia}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              {lote.obras?.nome || "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{lote.total_colaboradores || 0} vidas</Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(lote.valor_total)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {lote.created_at ? format(new Date(lote.created_at), "dd/MM/yyyy HH:mm") : "-"}
                          </TableCell>
                          <TableCell>{getStatusBadge(lote.status)}</TableCell>
                          <TableCell>
                            {notaFiscal ? (
                              notaFiscal.nf_emitida ? (
                                <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Sim</Badge>
                              ) : (
                                <Badge variant="secondary">Não</Badge>
                              )
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {notaFiscal?.nf_url ? (
                              <a
                                href={notaFiscal.nf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                              >
                                <FileText className="h-4 w-4" />
                                Ver NF
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {notaFiscal ? (
                              notaFiscal.boleto_gerado ? (
                                <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Sim</Badge>
                              ) : (
                                <Badge variant="secondary">Não</Badge>
                              )
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {notaFiscal?.boleto_url ? (
                              <a
                                href={notaFiscal.boleto_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                              >
                                <FileText className="h-4 w-4" />
                                Ver Boleto
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadLista(lote);
                              }}
                              title="Baixar lista de vidas"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                        Nenhuma lista enviada encontrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Paginação */}
              {totalCount > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} de {totalCount}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Historico;
