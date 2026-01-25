import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, FileText, ExternalLink, X } from "lucide-react";

interface NotaFiscal {
  id: string;
  empresa_id: string;
  lote_id: string;
  competencia: string;
  numero_vidas: number;
  valor_total: number;
  nf_emitida: boolean;
  nf_url: string | null;
  empresas: {
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
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const fetchNotasFiscais = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select(`
          *,
          empresas(nome),
          lotes_mensais(valor_total)
        `)
        .order("competencia", { ascending: false });

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

  const updateField = async (id: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from("notas_fiscais")
        .update({ [field]: value })
        .eq("id", id);

      if (error) throw error;

      setNotasFiscais(prev =>
        prev.map(nf =>
          nf.id === id ? { ...nf, [field]: value } : nf
        )
      );

      toast.success("Campo atualizado com sucesso");
    } catch (error: any) {
      console.error("Erro ao atualizar campo:", error);
      toast.error("Erro ao atualizar campo");
    }
  };

  const handleFileUpload = async (notaFiscal: NotaFiscal, file: File) => {
    if (!file) return;

    // Validar tamanho (máximo 15MB)
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Limite de 15MB.");
      return;
    }

    // Validar tipo
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Tipo de arquivo não permitido. Use PDF, PNG ou JPG.");
      return;
    }

    setUploadingId(notaFiscal.id);

    try {
      const fileExt = file.name.split('.').pop();
      const empresaNome = notaFiscal.empresas?.nome?.replace(/[^a-zA-Z0-9]/g, '_') || 'empresa';
      const fileName = `NF_${empresaNome}_${notaFiscal.competencia}_${Date.now()}.${fileExt}`;

      // Upload para o bucket
      const { error: uploadError } = await supabase.storage
        .from("notas-fiscais")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Pegar URL pública
      const { data: { publicUrl } } = supabase.storage
        .from("notas-fiscais")
        .getPublicUrl(fileName);

      // Atualizar no banco
      await updateField(notaFiscal.id, "nf_url", publicUrl);

      toast.success("Nota fiscal anexada com sucesso!");
    } catch (error: any) {
      console.error("Erro ao fazer upload:", error);
      toast.error(error.message || "Erro ao anexar nota fiscal");
    } finally {
      setUploadingId(null);
    }
  };

  const handleRemoveFile = async (notaFiscal: NotaFiscal) => {
    try {
      // Extrair o nome do arquivo da URL
      if (notaFiscal.nf_url) {
        const urlParts = notaFiscal.nf_url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        
        // Tentar deletar do storage
        await supabase.storage
          .from("notas-fiscais")
          .remove([fileName]);
      }

      // Limpar a URL no banco
      await updateField(notaFiscal.id, "nf_url", null);
      
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
    if (mesFilter === "todos") return notasFiscais;
    return notasFiscais.filter(nf => nf.competencia === mesFilter);
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
        <h1 className="text-3xl font-bold tracking-tight">Notas Fiscais</h1>
        <p className="text-muted-foreground">
          Gerenciamento de notas fiscais das empresas
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista de Notas Fiscais</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filtrar por mês:</span>
              <Select value={mesFilter} onValueChange={setMesFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {competenciasList.map(comp => (
                    <SelectItem key={comp} value={comp}>
                      {comp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredNotasFiscais.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma nota fiscal encontrada.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência (Mês)</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>N° de Vidas</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>NF Emitida</TableHead>
                  <TableHead>Anexo NF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNotasFiscais.map((nf) => {
                  const valorTotal = nf.lotes_mensais?.valor_total || nf.valor_total || 0;
                  const isUploading = uploadingId === nf.id;
                  
                  return (
                    <TableRow key={nf.id}>
                      <TableCell>{nf.competencia}</TableCell>
                      <TableCell>{nf.empresas?.nome || "Empresa não encontrada"}</TableCell>
                      <TableCell>{nf.numero_vidas}</TableCell>
                      <TableCell>
                        {valorTotal.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        })}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={nf.nf_emitida ? "sim" : "nao"}
                          onValueChange={(value) =>
                            updateField(nf.id, "nf_emitida", value === "sim")
                          }
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
                              // Arquivo já anexado - mostrar link e botão de remover
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  asChild
                                  className="gap-1"
                                >
                                  <a href={nf.nf_url} target="_blank" rel="noopener noreferrer">
                                    <FileText className="h-4 w-4" />
                                    Ver NF
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveFile(nf)}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              // Sem arquivo - mostrar input de upload
                              <div className="flex items-center gap-2">
                                <Input
                                  type="file"
                                  accept=".pdf,.png,.jpg,.jpeg"
                                  className="w-[180px] text-xs"
                                  disabled={isUploading}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileUpload(nf, file);
                                  }}
                                />
                                {isUploading && (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Marque como emitida
                          </span>
                        )}
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
