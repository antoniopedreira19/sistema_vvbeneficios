import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, Clock, AlertTriangle, CheckCircle2, Inbox, Upload, Search, ArrowUpDown } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LotesTable, LoteOperacional } from "@/components/admin/operacional/LotesTable";
import { ProcessarRetornoDialog } from "@/components/admin/operacional/ProcessarRetornoDialog";
import { AdminImportarLoteDialog } from "@/components/admin/operacional/AdminImportarLoteDialog";
import { EditarLoteDialog } from "@/components/admin/operacional/EditarLoteDialog";
import { CobrancaMassaDialog } from "@/components/admin/operacional/CobrancaMassaDialog";
import ExcelJS from "exceljs";
import { formatCNPJ, formatCPF } from "@/lib/validators";

const ITEMS_PER_PAGE = 100;

type TabType = "entrada" | "seguradora" | "pendencia" | "concluido";
type SortType = "alfabetica" | "recente";

// --- FUNÇÃO AUXILIAR PARA BUSCAR TUDO (BYPASS LIMIT 1000) ---
// Essa função busca em pedaços de 1000 até acabar
const fetchAllColaboradores = async (loteId: string) => {
  let allData: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("colaboradores_lote")
      .select("nome, sexo, cpf, data_nascimento, salario, classificacao_salario, created_at")
      .eq("lote_id", loteId)
      .order("created_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;

    if (data && data.length > 0) {
      allData = [...allData, ...data];
      // Se vier menos que o tamanho da página, chegamos ao fim
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }
  return allData;
};

export default function Operacional() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("entrada");

  // Estados de Filtro e Ordenação
  const [searchTerm, setSearchTerm] = useState("");
  const [competenciaFilter, setCompetenciaFilter] = useState<string>("todas");
  const [sortBy, setSortBy] = useState<SortType>("alfabetica");

  const [pages, setPages] = useState<Record<TabType, number>>({
    entrada: 1,
    seguradora: 1,
    pendencia: 1,
    concluido: 1,
  });

  // Dialogs States
  const [selectedLote, setSelectedLote] = useState<LoteOperacional | null>(null);
  const [loteParaEditar, setLoteParaEditar] = useState<LoteOperacional | null>(null);

  const [confirmEnviarDialog, setConfirmEnviarDialog] = useState(false);
  const [confirmFaturarDialog, setConfirmFaturarDialog] = useState(false);
  const [confirmResolverDialog, setConfirmResolverDialog] = useState(false);
  const [confirmRejeitarDialog, setConfirmRejeitarDialog] = useState(false);
  const [processarDialogOpen, setProcessarDialogOpen] = useState(false);
  const [importarDialogOpen, setImportarDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // --- QUERY ---
  const { data: lotes = [], isLoading } = useQuery({
    queryKey: ["lotes-operacional"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotes_mensais")
        .select(
          `
          id, competencia, total_colaboradores, total_reprovados, total_aprovados, valor_total, created_at, status, empresa_id,
          empresa:empresas(nome, cnpj),
          obra:obras(id, nome) 
        `,
        )
        .in("status", ["aguardando_processamento", "em_analise_seguradora", "com_pendencia", "concluido", "faturado"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as LoteOperacional[];
    },
  });

  // Extrair competências únicas dos lotes existentes
  const competencias = [...new Set(lotes.map((l) => l.competencia))].sort((a, b) => {
    // Ordenar por data (mais recente primeiro)
    const parseCompetencia = (comp: string) => {
      const meses: Record<string, number> = {
        Janeiro: 0,
        Fevereiro: 1,
        Março: 2,
        Abril: 3,
        Maio: 4,
        Junho: 5,
        Julho: 6,
        Agosto: 7,
        Setembro: 8,
        Outubro: 9,
        Novembro: 10,
        Dezembro: 11,
      };
      const [mes, ano] = comp.split("/");
      return new Date(parseInt(ano), meses[mes] || 0, 1);
    };
    return parseCompetencia(b).getTime() - parseCompetencia(a).getTime();
  });

  // --- Lógica de Filtragem e Ordenação Dinâmica ---
  const filteredLotes = lotes
    .filter((l) => {
      const matchSearch = l.empresa?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCompetencia = competenciaFilter === "todas" || l.competencia === competenciaFilter;
      return matchSearch && matchCompetencia;
    })
    .sort((a, b) => {
      if (sortBy === "alfabetica") {
        return (a.empresa?.nome || "").localeCompare(b.empresa?.nome || "");
      } else {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const getLotesByTab = (tab: TabType) => {
    switch (tab) {
      case "entrada":
        return filteredLotes.filter((l) => l.status === "aguardando_processamento");
      case "seguradora":
        return filteredLotes.filter((l) => l.status === "em_analise_seguradora");
      case "pendencia":
        return filteredLotes.filter((l) => l.status === "com_pendencia");
      case "concluido":
        // Apenas lotes concluídos (não faturados) aparecem em "Prontos"
        return filteredLotes.filter((l) => l.status === "concluido");
      default:
        return [];
    }
  };

  // --- MUTAÇÃO DE ENVIO COM GERAÇÃO DE EXCEL E UPLOAD ---
  const enviarNovoMutation = useMutation({
    mutationFn: async (lote: LoteOperacional) => {
      setActionLoading(lote.id);

      try {
        toast.info("Gerando arquivo e enviando para nuvem...");

        // 1. Buscar TODOS os dados (Bypass limit 1000)
        const itens = await fetchAllColaboradores(lote.id);

        if (!itens || itens.length === 0) throw new Error("Lote vazio, impossível enviar.");

        // 2. Filtrar Duplicatas (Manter apenas o mais recente)
        const cpfsProcessados = new Set();
        const itensUnicos = itens.filter((item) => {
          const cpfLimpo = item.cpf.replace(/\D/g, "");
          if (cpfsProcessados.has(cpfLimpo)) return false;
          cpfsProcessados.add(cpfLimpo);
          return true;
        });
        itensUnicos.sort((a: any, b: any) => a.nome.localeCompare(b.nome));

        // 3. Gerar o Excel em Memória
        let cnpj = (lote.empresa as any)?.cnpj || "";
        if (!cnpj && lote.empresa_id) {
          const { data: emp } = await supabase.from("empresas").select("cnpj").eq("id", lote.empresa_id).single();
          if (emp) cnpj = emp.cnpj;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Lista Seguradora");
        const headers = [
          "NOME COMPLETO",
          "SEXO",
          "CPF",
          "DATA NASCIMENTO",
          "SALARIO",
          "CLASSIFICACAO SALARIAL",
          "CNPJ DA EMPRESA",
        ];
        const headerRow = worksheet.addRow(headers);

        // Estilização
        const COL_WIDTH = 37.11;
        worksheet.columns = headers.map(() => ({ width: COL_WIDTH }));
        headerRow.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF203455" } };
          cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
          cell.alignment = { horizontal: "center" };
        });

        itensUnicos.forEach((c: any) => {
          let dataNascDate = null;
          if (c.data_nascimento) {
            const parts = c.data_nascimento.split("-");
            if (parts.length === 3)
              dataNascDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          }
          const row = worksheet.addRow([
            c.nome?.toUpperCase(),
            c.sexo,
            formatCPF(c.cpf),
            dataNascDate,
            c.salario ? Number(c.salario) : 0,
            c.classificacao_salario,
            formatCNPJ(cnpj),
          ]);
          if (dataNascDate) row.getCell(4).numFmt = "dd/mm/yyyy";
          row.getCell(5).numFmt = "#,##0.00";
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

        // 4. Personalizar Nome do Arquivo
        const nomeEmpresaRaw = lote.empresa?.nome || "EMPRESA";
        const nomeEmpresaLimpo = nomeEmpresaRaw
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9\s]/g, "")
          .trim()
          .replace(/\s+/g, "_")
          .toUpperCase();

        const competenciaLimpa = lote.competencia.replace(/\//g, "-");
        const fileName = `lotes/LISTA_${nomeEmpresaLimpo}_${competenciaLimpa}.xlsx`;

        // 5. Upload para o Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from("contratos")
          .upload(fileName, blob, { upsert: true });

        if (uploadError) throw uploadError;

        // 6. Pegar a URL Pública
        const {
          data: { publicUrl },
        } = supabase.storage.from("contratos").getPublicUrl(fileName);

        // 7. Atualizar Banco de Dados (Isso dispara o Webhook)
        const { error: updateError } = await supabase
          .from("lotes_mensais")
          .update({
            status: "em_analise_seguradora",
            enviado_seguradora_em: new Date().toISOString(),
            arquivo_url: publicUrl,
          })
          .eq("id", lote.id);

        if (updateError) throw updateError;
      } catch (error: any) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] });
      toast.success("Enviado para Seguradora");
      setConfirmEnviarDialog(false);
      setActionLoading(null);
      setSelectedLote(null);
    },
    onError: (e: any) => {
      toast.error("Erro: " + e.message);
      setActionLoading(null);
    },
  });

  const faturarMutation = useMutation({
    mutationFn: async (lote: LoteOperacional) => {
      setActionLoading(lote.id);
      const vidas = (lote.total_colaboradores || 0) - (lote.total_reprovados || 0);
      const valor = vidas * 50;
      const { error } = await supabase
        .from("lotes_mensais")
        .update({ status: "faturado", valor_total: valor })
        .eq("id", lote.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] });
      toast.success("Faturado com sucesso!");
      setConfirmFaturarDialog(false);
      setActionLoading(null);
      setSelectedLote(null);
    },
    onError: (e: any) => {
      toast.error("Erro: " + e.message);
      setActionLoading(null);
    },
  });

  // --- MUTAÇÃO DE RESOLVER PENDÊNCIA ---
  const resolverPendenciaMutation = useMutation({
    mutationFn: async (lote: LoteOperacional) => {
      setActionLoading(lote.id);

      // 1. Buscar lote destino (mesma empresa, obra, competência)
      let query = supabase
        .from("lotes_mensais")
        .select("id, total_colaboradores")
        .eq("empresa_id", lote.empresa_id)
        .eq("competencia", lote.competencia)
        .in("status", ["concluido", "faturado"])
        .neq("id", lote.id);

      // Tratar obra_id null vs valor
      if (lote.obra?.id) {
        query = query.eq("obra_id", lote.obra.id);
      } else {
        query = query.is("obra_id", null);
      }

      const { data: loteDestino, error: fetchError } = await query.maybeSingle();

      if (fetchError) throw fetchError;
      if (!loteDestino) {
        throw new Error(
          "Nenhum lote encontrado para mesclar. Verifique se existe um lote concluído ou faturado da mesma empresa, obra e competência.",
        );
      }

      // 2. Migrar colaboradores_lote do lote pendente para o lote destino E marcar como aprovados
      const { error: migrateError } = await supabase
        .from("colaboradores_lote")
        .update({
          lote_id: loteDestino.id,
          status_seguradora: "aprovado", // Ao resolver, o colaborador é aprovado
          motivo_reprovacao_seguradora: null, // Limpa o motivo de reprovação
        })
        .eq("lote_id", lote.id);

      if (migrateError) throw migrateError;

      // 3. Incrementar vidas no lote destino
      const novoTotal = (loteDestino.total_colaboradores || 0) + (lote.total_reprovados || 0);
      const { error: updateError } = await supabase
        .from("lotes_mensais")
        .update({ total_colaboradores: novoTotal })
        .eq("id", loteDestino.id);

      if (updateError) throw updateError;

      // 4. Excluir o lote pendente (agora sem colaboradores)
      const { error: deleteError } = await supabase.from("lotes_mensais").delete().eq("id", lote.id);

      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] });
      toast.success("Pendência resolvida! Vidas incrementadas no lote original.");
      setConfirmResolverDialog(false);
      setActionLoading(null);
      setSelectedLote(null);
    },
    onError: (e: any) => {
      toast.error(e.message);
      setActionLoading(null);
    },
  });

  // --- MUTAÇÃO DE REJEITAR PENDÊNCIA ---
  const rejeitarPendenciaMutation = useMutation({
    mutationFn: async (lote: LoteOperacional) => {
      setActionLoading(lote.id);

      // Excluir o lote pendente diretamente
      const { error } = await supabase.from("lotes_mensais").delete().eq("id", lote.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] });
      toast.success("Lote pendente excluído.");
      setConfirmRejeitarDialog(false);
      setActionLoading(null);
      setSelectedLote(null);
    },
    onError: (e: any) => {
      toast.error("Erro: " + e.message);
      setActionLoading(null);
    },
  });

  // --- MUTAÇÃO DE ENVIAR PENDÊNCIA PARA CLIENTE ---
  const enviarPendenciaClienteMutation = useMutation({
    mutationFn: async (lote: LoteOperacional) => {
      setActionLoading(lote.id);

      // Buscar dados dos colaboradores reprovados
      const { data: reprovados, error: fetchError } = await supabase
        .from("colaboradores_lote")
        .select("nome, cpf, motivo_reprovacao_seguradora")
        .eq("lote_id", lote.id)
        .eq("status_seguradora", "reprovado");

      if (fetchError) throw fetchError;

      // Criar notificação que dispara o webhook
      const { error: notifError } = await supabase.rpc("criar_notificacao", {
        p_tipo: "admin_gerencia_aprovacoes",
        p_empresa_id: lote.empresa_id,
        p_lote_id: lote.id,
        p_destinatario_role: "cliente",
        p_obra_id: lote.obra?.id || null,
        p_dados: {
          competencia: lote.competencia,
          total_aprovados: (lote.total_colaboradores || 0) - (lote.total_reprovados || 0),
          total_reprovados: lote.total_reprovados || 0,
          reprovados:
            reprovados?.map((r) => ({
              nome: r.nome,
              cpf: r.cpf,
              motivo: r.motivo_reprovacao_seguradora,
            })) || [],
          nome_obra: lote.obra?.nome || "Sem obra especificada",
        },
      });

      if (notifError) throw notifError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes-operacional"] });
      toast.success("Notificação de pendência enviada ao cliente!");
      setActionLoading(null);
      setSelectedLote(null);
    },
    onError: (e: any) => {
      toast.error("Erro ao enviar notificação: " + e.message);
      setActionLoading(null);
    },
  });

  const handleDownloadLote = async (lote: LoteOperacional) => {
    try {
      toast.info("Preparando download... (Isso pode demorar um pouco para lotes grandes)");

      // 1. Busca todos os itens (usando a função de loop para bypassar limite de 1000)
      const itens = await fetchAllColaboradores(lote.id);

      if (!itens || itens.length === 0) {
        toast.warning("Não há colaboradores neste lote para baixar.");
        return;
      }

      // 2. FILTRAGEM DE DUPLICATAS
      const cpfsProcessados = new Set();
      const itensUnicos = itens.filter((item: any) => {
        const cpfLimpo = item.cpf.replace(/\D/g, "");
        if (cpfsProcessados.has(cpfLimpo)) {
          return false;
        }
        cpfsProcessados.add(cpfLimpo);
        return true;
      });

      // 3. Ordenação Alfabética para o Excel
      itensUnicos.sort((a: any, b: any) => a.nome.localeCompare(b.nome));

      let cnpj = (lote.empresa as any)?.cnpj || "";
      if (!cnpj && lote.empresa_id) {
        const { data: emp } = await supabase.from("empresas").select("cnpj").eq("id", lote.empresa_id).single();
        if (emp) cnpj = emp.cnpj;
      }
      cnpj = cnpj.replace(/\D/g, "");

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Lista Seguradora");
      const headers = [
        "NOME COMPLETO",
        "SEXO",
        "CPF",
        "DATA NASCIMENTO",
        "SALARIO",
        "CLASSIFICACAO SALARIAL",
        "CNPJ DA EMPRESA",
      ];
      const headerRow = worksheet.addRow(headers);

      const COL_WIDTH = 37.11;
      worksheet.columns = headers.map(() => ({ width: COL_WIDTH }));

      headerRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF203455" } };
        cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
        cell.alignment = { horizontal: "center" };
      });

      itensUnicos.forEach((c: any) => {
        let dataNascDate = null;
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
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SEGURADORA_${lote.empresa?.nome.replace(/[^a-zA-Z0-9]/g, "")}_${lote.competencia.replace("/", "-")}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Download concluído.");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao gerar planilha: " + e.message);
    }
  };

  const handleAction = (lote: LoteOperacional, tab: string) => {
    setSelectedLote(lote);
    if (tab === "entrada") setConfirmEnviarDialog(true);
    else if (tab === "seguradora") setProcessarDialogOpen(true);
    else if (tab === "concluido") setConfirmFaturarDialog(true);
    else if (tab === "pendencia") {
      // Enviar notificação de pendência para o cliente via webhook
      enviarPendenciaClienteMutation.mutate(lote);
    }
  };

  const handleResolve = (lote: LoteOperacional) => {
    setSelectedLote(lote);
    setConfirmResolverDialog(true);
  };

  const handleReject = (lote: LoteOperacional) => {
    setSelectedLote(lote);
    setConfirmRejeitarDialog(true);
  };

  const handleConfirmarEnvio = () => {
    if (!selectedLote) return;
    // IMPORTANTE: Agora passamos o objeto completo, pois precisamos do ID da empresa para o nome do arquivo
    enviarNovoMutation.mutate(selectedLote);
  };

  const getPaginatedLotes = (tab: TabType) => {
    const data = getLotesByTab(tab);
    const page = pages[tab] || 1;
    const start = (page - 1) * ITEMS_PER_PAGE;
    return data.slice(start, start + ITEMS_PER_PAGE);
  };
  const getTotalPages = (tab: TabType) => Math.ceil(getLotesByTab(tab).length / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Operacional</h1>
            <p className="text-muted-foreground">Gestão de Fluxo de Lotes</p>
          </div>
        </div>

        {/* Controles: Busca, Ordenação e Importação */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por empresa..."
              className="pl-8 bg-background"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPages({ entrada: 1, seguradora: 1, pendencia: 1, concluido: 1 });
              }}
            />
          </div>

          <Select
            value={competenciaFilter}
            onValueChange={(v) => {
              setCompetenciaFilter(v);
              setPages({ entrada: 1, seguradora: 1, pendencia: 1, concluido: 1 });
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

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortType)}>
            <SelectTrigger className="w-full md:w-[180px] bg-background">
              <ArrowUpDown className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alfabetica">Ordem Alfabética</SelectItem>
              <SelectItem value="recente">Mais Recentes</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={() => setImportarDialogOpen(true)} variant="outline">
            <Upload className="mr-2 h-4 w-4" /> Importar
          </Button>

          <CobrancaMassaDialog />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabTriggerItem id="entrada" label="Entrada" icon={Inbox} count={getLotesByTab("entrada").length} />
          <TabTriggerItem id="seguradora" label="Seguradora" icon={Clock} count={getLotesByTab("seguradora").length} />
          <TabTriggerItem
            id="pendencia"
            label="Pendências"
            icon={AlertTriangle}
            count={getLotesByTab("pendencia").length}
            variant="destructive"
          />
          <TabTriggerItem
            id="concluido"
            label="Prontos"
            icon={CheckCircle2}
            count={getLotesByTab("concluido").length}
            variant="default"
          />
        </TabsList>

        {renderTabContent(
          "entrada",
          "Entrada de Novos Lotes",
          <Inbox className="text-blue-500" />,
          getPaginatedLotes,
          pages,
          setPages,
          handleAction,
          actionLoading,
          "enviar",
          getTotalPages,
          handleDownloadLote,
          setLoteParaEditar,
        )}
        {renderTabContent(
          "seguradora",
          "Novos em Análise",
          <Clock className="text-yellow-500" />,
          getPaginatedLotes,
          pages,
          setPages,
          handleAction,
          actionLoading,
          "processar",
          getTotalPages,
          handleDownloadLote,
          setLoteParaEditar,
        )}
        <TabsContent value="pendencia" className="mt-6">
          <TabCard title="Lotes com Pendências (Reprovados)" icon={AlertTriangle} color="text-red-500">
            <LotesTable
              lotes={getPaginatedLotes("pendencia")}
              isLoading={false}
              currentPage={pages.pendencia}
              totalPages={getTotalPages("pendencia")}
              onPageChange={(p: number) => setPages((prev: any) => ({ ...prev, pendencia: p }))}
              actionType="resolver_pendencia"
              onAction={(l: any) => handleAction(l, "pendencia")}
              actionLoading={actionLoading}
              onDownload={handleDownloadLote}
              onEdit={setLoteParaEditar}
              onResolve={handleResolve}
              onReject={handleReject}
            />
          </TabCard>
        </TabsContent>
        {renderTabContent(
          "concluido",
          "Prontos para Faturamento",
          <CheckCircle2 className="text-green-500" />,
          getPaginatedLotes,
          pages,
          setPages,
          handleAction,
          actionLoading,
          "faturar",
          getTotalPages,
          handleDownloadLote,
          setLoteParaEditar,
        )}
      </Tabs>

      <AlertDialog open={confirmEnviarDialog} onOpenChange={setConfirmEnviarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar Lote para Seguradora?</AlertDialogTitle>
            <AlertDialogDescription>O lote será enviado para análise inicial da seguradora.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmarEnvio}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmFaturarDialog} onOpenChange={setConfirmFaturarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Liberar Faturamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá gerar a NF para o lote de <strong>{selectedLote?.empresa?.nome}</strong>.<br />
              Valor estimado:{" "}
              <strong>R$ {((selectedLote?.total_colaboradores || 0) * 50).toLocaleString("pt-BR")}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedLote && faturarMutation.mutate(selectedLote)}>
              Liberar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmResolverDialog} onOpenChange={setConfirmResolverDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resolver Pendência?</AlertDialogTitle>
            <AlertDialogDescription>
              As <strong>{selectedLote?.total_reprovados || 0} vidas</strong> pendentes serão adicionadas ao lote
              original da empresa <strong>{selectedLote?.empresa?.nome}</strong> ({selectedLote?.competencia}).
              <br />
              <br />O lote pendente será excluído após a operação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedLote && resolverPendenciaMutation.mutate(selectedLote)}
              className="bg-green-600 hover:bg-green-700"
            >
              Confirmar Resolução
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRejeitarDialog} onOpenChange={setConfirmRejeitarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lote Pendente?</AlertDialogTitle>
            <AlertDialogDescription>
              O lote pendente da empresa <strong>{selectedLote?.empresa?.nome}</strong> ({selectedLote?.competencia})
              será excluído permanentemente.
              <br />
              <br />
              As <strong>{selectedLote?.total_reprovados || 0} vidas</strong> não serão adicionadas a nenhum lote.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedLote && rejeitarPendenciaMutation.mutate(selectedLote)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir Lote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AdminImportarLoteDialog open={importarDialogOpen} onOpenChange={setImportarDialogOpen} />

      {selectedLote && (
        <ProcessarRetornoDialog
          open={processarDialogOpen}
          onOpenChange={setProcessarDialogOpen}
          loteId={selectedLote.id}
          empresaNome={selectedLote.empresa?.nome || ""}
          competencia={selectedLote.competencia}
        />
      )}

      {loteParaEditar && (
        <EditarLoteDialog
          lote={loteParaEditar}
          open={!!loteParaEditar}
          onOpenChange={(o) => !o && setLoteParaEditar(null)}
        />
      )}
    </div>
  );
}

const TabTriggerItem = ({ id, label, icon: Icon, count, variant = "secondary" }: any) => (
  <TabsTrigger value={id} className="flex items-center gap-2">
    <Icon className="h-4 w-4" /> {label}
    <Badge variant={variant} className="ml-1">
      {count}
    </Badge>
  </TabsTrigger>
);

const TabCard = ({ title, icon: Icon, color, children }: any) => (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-lg">
        <Icon className={`h-5 w-5 ${color}`} /> {title}
      </CardTitle>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

function renderTabContent(
  value: TabType,
  title: string,
  icon: any,
  getLotes: any,
  pages: any,
  setPages: any,
  handleAction: any,
  actionLoading: any,
  actionType: any,
  getTotal: any,
  onDownload: any,
  onEdit: any,
) {
  return (
    <TabsContent value={value} className="mt-6">
      <TabCard title={title} icon={icon.type} color={icon.props.className}>
        <LotesTable
          lotes={getLotes(value)}
          isLoading={false}
          currentPage={pages[value]}
          totalPages={getTotal(value)}
          onPageChange={(p: number) => setPages((prev: any) => ({ ...prev, [value]: p }))}
          actionType={actionType}
          onAction={(l: any) => handleAction(l, value)}
          actionLoading={actionLoading}
          onDownload={onDownload}
          onEdit={onEdit}
        />
      </TabCard>
    </TabsContent>
  );
}
