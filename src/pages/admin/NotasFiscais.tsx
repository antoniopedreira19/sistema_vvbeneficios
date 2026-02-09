import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, FileText, ExternalLink, X, Search } from "lucide-react";
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
  boleto_gerado: boolean;
  boleto_url: string | null;
  empresas: {
    nome: string;
  } | null;
  obras: {
    nome: string;
  } | null;
  lotes_mensais: {
    valor_total: number;
  } | null;
}
const NotasFiscais = () => {
  const [notasFiscais, setNotasFiscais] = useState<NotaFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesFilter, setMesFilter] = useState<string>("todos");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const fetchNotasFiscais = async () => {
    try {
      setLoading(true);
      const {
        data,
        error
      } = await supabase.from("notas_fiscais").select(`
          *,
          empresas(nome),
          obras(nome),
          lotes_mensais(valor_total)
        `).order("competencia", {
        ascending: false
      });
      if (error) throw error;
      setNotasFiscais(data as any || []);
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
  const updateField = async (id: string, field: string, value: any) => {
    try {
      const {
        error
      } = await supabase.from("notas_fiscais").update({
        [field]: value
      }).eq("id", id);
      if (error) throw error;
      setNotasFiscais(prev => prev.map(nf => nf.id === id ? {
        ...nf,
        [field]: value
      } : nf));
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
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Tipo de arquivo não permitido. Use PDF, PNG ou JPG.");
      return;
    }
    setUploadingId(notaFiscal.id);
    setUploadingField(field);
    try {
      const fileExt = file.name.split('.').pop();
      const empresaNome = notaFiscal.empresas?.nome?.replace(/[^a-zA-Z0-9]/g, '_') || 'empresa';
      const prefix = field === "nf_url" ? "NF" : "BOL";
      const fileName = `${prefix}_${empresaNome}_${notaFiscal.competencia}_${Date.now()}.${fileExt}`;
      const {
        error: uploadError
      } = await supabase.storage.from("notas-fiscais").upload(fileName, file, {
        upsert: true
      });
      if (uploadError) throw uploadError;
      const {
        data: {
          publicUrl
        }
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
      const url = notaFiscal[field];
      if (url) {
        const urlParts = url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        await supabase.storage.from("notas-fiscais").remove([fileName]);
      }
      await updateField(notaFiscal.id, field, null);
      toast.success("Arquivo removido com sucesso");
    } catch (error: any) {
      console.error("Erro ao remover arquivo:", error);
      toast.error("Erro ao remover arquivo");
    }
  };
  const competenciasList = useMemo(() => {
    const competencias = Array.from(new Set(notasFiscais.map(nf => nf.competencia)));
    return competencias.sort().reverse();
  }, [notasFiscais]);
  const filteredNotasFiscais = useMemo(() => {
    let filtered = notasFiscais;

    // Filtrar por mês
    if (mesFilter !== "todos") {
      filtered = filtered.filter(nf => nf.competencia === mesFilter);
    }

    // Filtrar por busca (nome da empresa ou obra)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(nf => nf.empresas?.nome?.toLowerCase().includes(term) || nf.obras?.nome?.toLowerCase().includes(term));
    }
    return filtered;
  }, [notasFiscais, mesFilter, searchTerm]);
  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>;
  }
  return <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notas Fiscais</h1>
        <p className="text-muted-foreground">
          Gerenciamento de notas fiscais das empresas
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista de Notas Fiscais</CardTitle>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por empresa ou obra..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 w-[250px]" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Mês:</span>
                <Select value={mesFilter} onValueChange={setMesFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {competenciasList.map(comp => <SelectItem key={comp} value={comp}>
                        {comp}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredNotasFiscais.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma nota fiscal encontrada.
            </p> : <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Vidas</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>NF Emitida</TableHead>
                  <TableHead>Anexo NF</TableHead>
                  <TableHead>Boleto Gerado</TableHead>
                  <TableHead>Anexo Boleto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNotasFiscais.map(nf => {
              const valorTotal = nf.lotes_mensais?.valor_total || nf.valor_total || 0;
              const isUploadingNF = uploadingId === nf.id && uploadingField === "nf_url";
              const isUploadingBoleto = uploadingId === nf.id && uploadingField === "boleto_url";
              return <TableRow key={nf.id}>
                      <TableCell>{nf.competencia}</TableCell>
                      <TableCell>{nf.empresas?.nome || "Empresa não encontrada"}</TableCell>
                      <TableCell>{nf.obras?.nome || "-"}</TableCell>
                      <TableCell>{nf.numero_vidas}</TableCell>
                      <TableCell>
                        {valorTotal.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  })}
                      </TableCell>
                      <TableCell>
                        <Select value={nf.nf_emitida ? "sim" : "nao"} onValueChange={value => updateField(nf.id, "nf_emitida", value === "sim")}>
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
                        {nf.nf_emitida ? <div className="flex items-center gap-2">
                            {nf.nf_url ? <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" asChild className="gap-1">
                                  <a href={nf.nf_url} target="_blank" rel="noopener noreferrer">
                                    <FileText className="h-4 w-4" />
                                    Ver NF
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleRemoveFile(nf, "nf_url")} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                  <X className="h-4 w-4" />
                                </Button>
                              </div> : <div className="flex items-center gap-2">
                                <label className="cursor-pointer inline-flex items-center gap-1 px-3 py-2 text-xs border rounded-md hover:bg-primary hover:text-primary-foreground">
                                  <Upload className="h-3 w-3" />
                                  Anexar NF
                                  <Input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" disabled={isUploadingNF} onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(nf, file, "nf_url");
                        }} />
                                </label>
                                {isUploadingNF && <Loader2 className="h-4 w-4 animate-spin" />}
                              </div>}
                          </div> : <span className="text-xs text-muted-foreground">Marque como emitida</span>}
                      </TableCell>
                      <TableCell>
                        <Select value={nf.boleto_gerado ? "sim" : "nao"} onValueChange={value => updateField(nf.id, "boleto_gerado", value === "sim")}>
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
                        {nf.boleto_gerado ? <div className="flex items-center gap-2">
                            {nf.boleto_url ? <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" asChild className="gap-1">
                                  <a href={nf.boleto_url} target="_blank" rel="noopener noreferrer">
                                    <FileText className="h-4 w-4" />
                                    Ver Boleto
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleRemoveFile(nf, "boleto_url")} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                  <X className="h-4 w-4" />
                                </Button>
                              </div> : <div className="flex items-center gap-2">
                                <label className="cursor-pointer inline-flex items-center gap-1 px-3 py-2 text-xs border rounded-md hover:bg-primary hover:text-primary-foreground">
                                  <Upload className="h-3 w-3" />
                                  Anexar Boleto
                                  <Input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" disabled={isUploadingBoleto} onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(nf, file, "boleto_url");
                        }} />
                                </label>
                                {isUploadingBoleto && <Loader2 className="h-4 w-4 animate-spin" />}
                              </div>}
                          </div> : <span className="text-xs text-muted-foreground">Marque como gerado</span>}
                      </TableCell>
                    </TableRow>;
            })}
              </TableBody>
            </Table>}
        </CardContent>
      </Card>
    </div>;
};
export default NotasFiscais;