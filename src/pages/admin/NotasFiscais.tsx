import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Upload,
  FileText,
  ExternalLink,
  X,
  Search,
  ReceiptText,
  FileCheck,
  CreditCard,
  CircleDollarSign,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
interface NotaFiscal {
  id: string;
  empresa_id: string;
  lote_id: string;
  obra_id: string | null;
  competencia: string;
  numero_vidas: number;
  valor_total: number;
  nf_emitida: boolean;
  nf_url: string | null;
  nf_emitida_em: string | null;
  boleto_gerado: boolean;
  boleto_url: string | null;
  boleto_gerado_em: string | null;
  pago: boolean;
  pago_em: string | null;
  empresas: {
    nome: string;
  } | null;
  obras: {
    nome: string;
  } | null;
  lotes_mensais: {
    valor_total: number;
    boleto_url: string | null;
  } | null;
}
const getCompetenciaAtual = () => {
  const now = new Date();
  const mes = now.toLocaleString("pt-BR", {
    month: "long",
  });
  return `${mes.charAt(0).toUpperCase() + mes.slice(1)}/${now.getFullYear()}`;
};
const NotasFiscais = () => {
  const [notasFiscais, setNotasFiscais] = useState<NotaFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesFilter, setMesFilter] = useState<string>(getCompetenciaAtual());
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [nfFilter, setNfFilter] = useState<string>("todos");
  const [boletoFilter, setBoletoFilter] = useState<string>("todos");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [generatingBoletoId, setGeneratingBoletoId] = useState<string | null>(null);

  const handleGerarBoleto = async (loteId: string, notaFiscalId: string) => {
    setGeneratingBoletoId(loteId);
    try {
      const response = await fetch("https://grifoworkspace.app.n8n.cloud/webhook/gerar-boleto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loteId }),
      });
      if (!response.ok) throw new Error("Erro na requisição");
      
      let boletoUrl: string | null = null;
      try {
        const result = await response.json();
        console.log("Resposta do webhook:", result);
        boletoUrl = result?.boleto_url || result?.bankSlipUrl || result?.invoiceUrl || null;
      } catch {
        console.warn("Resposta do webhook não é JSON válido");
      }

      if (boletoUrl) {
        await supabase.from("notas_fiscais").update({
          boleto_url: boletoUrl,
          boleto_gerado: true,
          boleto_gerado_em: new Date().toISOString(),
        }).eq("id", notaFiscalId);
        await supabase.from("lotes_mensais").update({
          boleto_url: boletoUrl,
        }).eq("id", loteId);
        // Update local state immediately
        setNotasFiscais((prev) =>
          prev.map((nf) =>
            nf.lote_id === loteId
              ? {
                  ...nf,
                  boleto_url: boletoUrl,
                  boleto_gerado: true,
                  boleto_gerado_em: new Date().toISOString(),
                  lotes_mensais: { ...(nf.lotes_mensais || {}), valor_total: nf.lotes_mensais?.valor_total || 0, boleto_url: boletoUrl },
                }
              : nf
          )
        );
        toast.success("Boleto gerado com sucesso!");
      } else {
        // URL not in response, refetch from DB to get latest state
        toast.success("Boleto gerado! Atualizando dados...");
        await fetchNotasFiscais();
      }
    } catch (error) {
      console.error("Erro ao gerar boleto:", error);
      toast.error("Erro ao gerar boleto. Tente novamente.");
    } finally {
      setGeneratingBoletoId(null);
    }
  };
  const fetchNotasFiscais = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select(
          `
          *,
          empresas(nome),
          obras(nome),
          lotes_mensais(valor_total, boleto_url)
        `,
        )
        .order("competencia", {
          ascending: false,
        });
      if (error) throw error;
      setNotasFiscais((data as any) || []);
    } catch (error: any) {
      console.error("Erro ao buscar notas fiscais:", error);
      toast.error("Erro ao carregar notas fiscais");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchNotasFiscais();
  }, []);
  const dateFieldMap: Record<string, string> = {
    nf_emitida: "nf_emitida_em",
    boleto_gerado: "boleto_gerado_em",
    pago: "pago_em",
  };
  const updateField = async (id: string, field: string, value: any) => {
    try {
      const updateData: Record<string, any> = {
        [field]: value,
      };
      const dateField = dateFieldMap[field];
      if (dateField) {
        updateData[dateField] = value ? new Date().toISOString() : null;
      }
      const { error } = await supabase.from("notas_fiscais").update(updateData).eq("id", id);
      if (error) throw error;
      setNotasFiscais((prev) =>
        prev.map((nf) =>
          nf.id === id
            ? {
                ...nf,
                ...updateData,
              }
            : nf,
        ),
      );
      toast.success("Campo atualizado com sucesso");
    } catch (error: any) {
      console.error("Erro ao atualizar campo:", error);
      toast.error("Erro ao atualizar campo");
    }
  };
  const handleFileUpload = async (notaFiscal: NotaFiscal, file: File, field: "nf_url" | "boleto_url") => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Limite de 15MB.");
      return;
    }
    const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Tipo de arquivo não permitido. Use PDF, PNG ou JPG.");
      return;
    }
    setUploadingId(notaFiscal.id);
    setUploadingField(field);
    try {
      const fileExt = file.name.split(".").pop();
      const empresaNome = notaFiscal.empresas?.nome?.replace(/[^a-zA-Z0-9]/g, "_") || "empresa";
      const prefix = field === "nf_url" ? "NF" : "BOL";
      const fileName = `${prefix}_${empresaNome}_${notaFiscal.competencia}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("notas-fiscais").upload(fileName, file, {
        upsert: true,
      });
      if (uploadError) throw uploadError;
      const {
        data: { publicUrl },
      } = supabase.storage.from("notas-fiscais").getPublicUrl(fileName);
      await updateField(notaFiscal.id, field, publicUrl);
      toast.success(field === "nf_url" ? "Nota fiscal anexada!" : "Boleto anexado!");
    } catch (error: any) {
      console.error("Erro ao fazer upload:", error);
      toast.error(error.message || "Erro ao anexar arquivo");
    } finally {
      setUploadingId(null);
      setUploadingField(null);
    }
  };
  const handleRemoveFile = async (notaFiscal: NotaFiscal, field: "nf_url" | "boleto_url") => {
    try {
      const url = notaFiscal[field] || (field === "boleto_url" ? (notaFiscal.lotes_mensais as any)?.boleto_url : null);
      if (url) {
        // Only try to remove from storage if it's a Supabase storage URL
        if (url.includes("supabase")) {
          const urlParts = url.split("/");
          const fileName = urlParts[urlParts.length - 1];
          await supabase.storage.from("notas-fiscais").remove([fileName]);
        }
      }
      await updateField(notaFiscal.id, field, null);
      if (field === "boleto_url") {
        await supabase.from("notas_fiscais").update({ boleto_gerado: false, boleto_gerado_em: null }).eq("id", notaFiscal.id);
        await supabase.from("lotes_mensais").update({ boleto_url: null, boleto_vencimento: null, asaas_payment_id: null }).eq("id", notaFiscal.lote_id);
        setNotasFiscais((prev) =>
          prev.map((nf) =>
            nf.id === notaFiscal.id
              ? { ...nf, boleto_gerado: false, boleto_gerado_em: null, lotes_mensais: { ...(nf.lotes_mensais || {}), valor_total: nf.lotes_mensais?.valor_total || 0, boleto_url: null } }
              : nf
          )
        );
      }
      toast.success("Arquivo removido com sucesso");
    } catch (error: any) {
      console.error("Erro ao remover arquivo:", error);
      toast.error("Erro ao remover arquivo");
    }
  };
  const competenciasList = useMemo(() => {
    const competencias = Array.from(new Set(notasFiscais.map((nf) => nf.competencia)));
    return competencias.sort().reverse();
  }, [notasFiscais]);
  const filteredNotasFiscais = useMemo(() => {
    let filtered = notasFiscais;
    if (mesFilter !== "todos") {
      filtered = filtered.filter((nf) => nf.competencia === mesFilter);
    }
    if (nfFilter !== "todos") {
      filtered = filtered.filter((nf) => (nfFilter === "sim" ? nf.nf_emitida : !nf.nf_emitida));
    }
    if (boletoFilter !== "todos") {
      filtered = filtered.filter((nf) => (boletoFilter === "sim" ? nf.boleto_gerado : !nf.boleto_gerado));
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(
        (nf) => nf.empresas?.nome?.toLowerCase().includes(term) || nf.obras?.nome?.toLowerCase().includes(term),
      );
    }
    return filtered;
  }, [notasFiscais, mesFilter, searchTerm, nfFilter, boletoFilter]);
  const kpis = useMemo(() => {
    const mesFiltrado =
      mesFilter !== "todos" ? notasFiscais.filter((nf) => nf.competencia === mesFilter) : notasFiscais;
    const total = mesFiltrado.length;
    const nfEmitidas = mesFiltrado.filter((nf) => nf.nf_emitida).length;
    const boletosGerados = mesFiltrado.filter((nf) => nf.boleto_gerado).length;
    const pagos = mesFiltrado.filter((nf) => nf.pago).length;
    const boletosNaoPagos = boletosGerados - pagos;
    const pctNf = total > 0 ? Math.round((nfEmitidas / total) * 100) : 0;
    const pctBoleto = total > 0 ? Math.round((boletosGerados / total) * 100) : 0;
    const pctPagoTotal = total > 0 ? Math.round((pagos / total) * 100) : 0;
    const pctPagoBoleto = boletosGerados > 0 ? Math.round((pagos / boletosGerados) * 100) : 0;
    return {
      total,
      nfEmitidas,
      boletosGerados,
      pagos,
      boletosNaoPagos,
      pctNf,
      pctBoleto,
      pctPagoTotal,
      pctPagoBoleto,
    };
  }, [notasFiscais, mesFilter]);
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Financeiro</h1>
        <p className="text-muted-foreground">Gerenciamento do fluxo financeiro das empresas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Lotes</CardTitle>
            <ReceiptText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.total}</div>
            <p className="text-xs text-muted-foreground">{mesFilter !== "todos" ? mesFilter : "Todos os meses"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">NFs Emitidas</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpis.nfEmitidas} <span className="text-sm font-normal text-muted-foreground">/ {kpis.total}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Progress value={kpis.pctNf} className="h-2" />
              <span className="text-sm font-medium">{kpis.pctNf}%</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Boletos Gerados</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpis.boletosGerados} <span className="text-sm font-normal text-muted-foreground">/ {kpis.total}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Progress value={kpis.pctBoleto} className="h-2" />
              <span className="text-sm font-medium">{kpis.pctBoleto}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos (do total)</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpis.pagos} <span className="text-sm font-normal text-muted-foreground">/ {kpis.total}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Progress value={kpis.pctPagoTotal} className="h-2" />
              <span className="text-sm font-medium">{kpis.pctPagoTotal}%</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos (dos boletos gerados)</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpis.pagos} <span className="text-sm font-normal text-muted-foreground">/ {kpis.boletosGerados}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Progress value={kpis.pctPagoBoleto} className="h-2" />
              <span className="text-sm font-medium">{kpis.pctPagoBoleto}%</span>
            </div>
            {kpis.boletosNaoPagos > 0 && (
              <p className="text-xs text-destructive mt-2">{kpis.boletosNaoPagos} boleto(s) pendente(s)</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista Financeira</CardTitle>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por empresa ou obra..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-[250px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Mês:</span>
                <Select value={mesFilter} onValueChange={setMesFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {competenciasList.map((comp) => (
                      <SelectItem key={comp} value={comp}>
                        {comp}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">NF:</span>
                <Select value={nfFilter} onValueChange={setNfFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    <SelectItem value="sim">Emitida</SelectItem>
                    <SelectItem value="nao">Não emitida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Boleto:</span>
                <Select value={boletoFilter} onValueChange={setBoletoFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="sim">Gerado</SelectItem>
                    <SelectItem value="nao">Não gerado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredNotasFiscais.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma nota fiscal encontrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Vidas</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>NF Emitida</TableHead>
                  <TableHead>Anexo NF</TableHead>
                  <TableHead>Boleto</TableHead>
                  <TableHead>Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNotasFiscais.map((nf) => {
                  const valorTotal = nf.lotes_mensais?.valor_total || nf.valor_total || 0;
                  const isUploadingNF = uploadingId === nf.id && uploadingField === "nf_url";
                  const isUploadingBoleto = uploadingId === nf.id && uploadingField === "boleto_url";
                  return (
                    <TableRow key={nf.id}>
                      <TableCell>{nf.competencia}</TableCell>
                      <TableCell>
                        <div>
                          <span>{nf.empresas?.nome || "Empresa não encontrada"}</span>
                          {nf.obras?.nome && (
                            <span className="block text-xs text-muted-foreground">{nf.obras.nome}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{nf.numero_vidas}</TableCell>
                      <TableCell>
                        {valorTotal.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={nf.nf_emitida ? "sim" : "nao"}
                          onValueChange={(value) => updateField(nf.id, "nf_emitida", value === "sim")}
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sim">Sim</SelectItem>
                            <SelectItem value="nao">Não</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {nf.nf_emitida ? (
                          <div className="flex items-center gap-2">
                            {nf.nf_url ? (
                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" asChild className="gap-1">
                                  <a href={nf.nf_url} target="_blank" rel="noopener noreferrer">
                                    <FileText className="h-4 w-4" />
                                    Ver NF
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveFile(nf, "nf_url")}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <label className="cursor-pointer inline-flex items-center gap-1 px-3 py-2 text-xs border rounded-md hover:bg-primary hover:text-primary-foreground">
                                  <Upload className="h-3 w-3" />
                                  Anexar NF
                                  <Input
                                    type="file"
                                    accept=".pdf,.png,.jpg,.jpeg"
                                    className="hidden"
                                    disabled={isUploadingNF}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleFileUpload(nf, file, "nf_url");
                                    }}
                                  />
                                </label>
                                {isUploadingNF && <Loader2 className="h-4 w-4 animate-spin" />}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Marque como emitida</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const boletoUrl = nf.boleto_url || (nf.lotes_mensais as any)?.boleto_url;
                          return boletoUrl ? (
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" className="gap-1" onClick={() => window.open(boletoUrl, '_blank')}>
                                <FileText className="h-4 w-4" />
                                Ver Boleto
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveFile(nf, "boleto_url")}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              className="gap-1"
                              disabled={generatingBoletoId === nf.lote_id}
                              onClick={() => handleGerarBoleto(nf.lote_id, nf.id)}
                            >
                              {generatingBoletoId === nf.lote_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CreditCard className="h-4 w-4" />
                              )}
                              {generatingBoletoId === nf.lote_id ? "Gerando..." : "Gerar Boleto"}
                            </Button>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={(nf as any).pago || false}
                          onCheckedChange={(checked) => updateField(nf.id, "pago", !!checked)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
export default NotasFiscais;
