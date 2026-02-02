import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCPF, formatCNPJ, formatCurrency } from "@/lib/validators";
import jsPDF from "jspdf";
import logoAdendo from "@/assets/logo-vv-adendo.png";

// Mapeamento de mês para abreviação
const MESES_ABREV: Record<string, string> = {
  "janeiro": "jan", "fevereiro": "fev", "março": "mar", "abril": "abr",
  "maio": "mai", "junho": "jun", "julho": "jul", "agosto": "ago",
  "setembro": "set", "outubro": "out", "novembro": "nov", "dezembro": "dez"
};

// Colors
const PRIMARY_COLOR = "#203455";

interface LoteOption {
  id: string;
  competencia: string;
  adendo_url?: string | null;
}

interface GerarAdendoBtnProps {
  empresaId: string;
  lotes?: LoteOption[];
  variant?: "default" | "outline" | "ghost";
  onAdendoGerado?: () => void;
}

export function GerarAdendoBtn({ 
  empresaId, 
  lotes = [], 
  variant = "outline",
  onAdendoGerado 
}: GerarAdendoBtnProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [selectedLoteId, setSelectedLoteId] = useState("");
  const [apolice, setApolice] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const getDataAtualExtenso = () => {
    const data = new Date();
    const meses = [
      "janeiro", "fevereiro", "março", "abril", "maio", "junho",
      "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
    ];
    return `Salvador, ${data.getDate()} de ${meses[data.getMonth()]} de ${data.getFullYear()}`;
  };

  const formatDataPTBR = (dateString: string) => {
    if (!dateString) return "--/--/----";
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  };

  const getFileNameFromCompetencia = (competencia: string, empresaNome: string) => {
    const [mesNome, ano] = competencia.split("/");
    const mesAbrev = MESES_ABREV[mesNome.toLowerCase()] || mesNome.substring(0, 3).toLowerCase();
    
    const nomeSlug = empresaNome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .substring(0, 30);
    
    return `adendo_${nomeSlug}_${mesAbrev}${ano}`;
  };

  const loadImageAsBase64 = (src: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = src;
    });
  };

  const generatePdfDirectly = async (empresa: any, colaboradores: any[], competencia: string) => {
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = 210;
    const pageHeight = 297;
    const marginLeft = 20;
    const marginRight = 20;
    const contentWidth = pageWidth - marginLeft - marginRight;
    
    // Carregar logo
    let logoBase64 = "";
    try {
      logoBase64 = await loadImageAsBase64(logoAdendo);
    } catch (e) {
      console.warn("Não foi possível carregar a logo", e);
    }

    // ===== PÁGINA 1: CAPA =====
    const drawHeader = (y: number) => {
      pdf.setDrawColor(PRIMARY_COLOR);
      pdf.setLineWidth(0.5);
      
      // Título
      pdf.setFontSize(12);
      pdf.setTextColor(PRIMARY_COLOR);
      pdf.setFont("helvetica", "bold");
      pdf.text("SEGURO DE ACIDENTES PESSOAIS COLETIVO", marginLeft, y);
      
      // Logo
      if (logoBase64) {
        pdf.addImage(logoBase64, "PNG", pageWidth - marginRight - 30, y - 10, 30, 15);
      }
      
      // Linha abaixo do header
      pdf.line(marginLeft, y + 5, pageWidth - marginRight, y + 5);
      
      return y + 15;
    };

    let y = drawHeader(25);

    // Data
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.setFont("helvetica", "normal");
    pdf.text(getDataAtualExtenso(), pageWidth - marginRight, y, { align: "right" });
    y += 15;

    // Informações do estipulante
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);
    
    const infoLines = [
      { label: "ESTIPULANTE:", value: "VV BENEFICIOS E CONSULTORIA LTDA" },
      { label: "CNPJ Nº:", value: "56.967.823/0001-45" },
      { label: "Email:", value: "contato@vvbeneficios.com.br" },
      { label: "Telefone:", value: "(71) 99692-8880" },
      { label: "APÓLICE Nº:", value: apolice },
      { label: "CORRETOR:", value: "GERSON BARTH PORTNOI" },
      { label: "COMPETÊNCIA:", value: competencia },
    ];

    infoLines.forEach((line) => {
      pdf.setFont("helvetica", "bold");
      pdf.text(line.label, marginLeft, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(line.value, marginLeft + 35, y);
      y += 6;
    });

    y += 10;

    // Texto do documento
    pdf.setFontSize(10);
    const texto1 = `Pelo presente documento, que passa a integrar a apólice nº ${apolice}, fica acordada entre as partes contratantes deste seguro que: A empresa mencionada está ativa e regular nesta apólice.`;
    const lines1 = pdf.splitTextToSize(texto1, contentWidth);
    pdf.text(lines1, marginLeft, y);
    y += lines1.length * 5 + 8;

    const texto2 = `Vigência: ${formatDataPTBR(dataInicio)} a ${formatDataPTBR(dataFim)} inclui-se o seguinte subestipulante:`;
    pdf.setFont("helvetica", "bold");
    pdf.text("Vigência:", marginLeft, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(`${formatDataPTBR(dataInicio)} a ${formatDataPTBR(dataFim)} inclui-se o seguinte subestipulante:`, marginLeft + 18, y);
    y += 15;

    // Seção: Dados da Empresa
    pdf.setFillColor(PRIMARY_COLOR);
    pdf.rect(marginLeft, y - 4, 3, 8, "F");
    pdf.setTextColor(PRIMARY_COLOR);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("DADOS DA EMPRESA", marginLeft + 6, y);
    y += 10;

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);
    
    pdf.setFont("helvetica", "bold");
    pdf.text("Nome:", marginLeft, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(empresa.nome.toUpperCase(), marginLeft + 15, y);
    y += 6;

    pdf.setFont("helvetica", "bold");
    pdf.text("CNPJ:", marginLeft, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(formatCNPJ(empresa.cnpj), marginLeft + 15, y);
    y += 6;

    pdf.setFont("helvetica", "bold");
    pdf.text("Endereço:", marginLeft, y);
    pdf.setFont("helvetica", "normal");
    const endereco = empresa.endereco || "Não informado";
    const enderecoLines = pdf.splitTextToSize(endereco, contentWidth - 25);
    pdf.text(enderecoLines, marginLeft + 22, y);
    y += enderecoLines.length * 5;

    // Assinatura (no final da página 1)
    const sigY = pageHeight - 50;
    pdf.setDrawColor(0, 0, 0);
    pdf.line(pageWidth / 2 - 50, sigY, pageWidth / 2 + 50, sigY);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("ESTIPULANTE", pageWidth / 2, sigY + 6, { align: "center" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text("Assinatura do Representante Legal", pageWidth / 2, sigY + 11, { align: "center" });

    // ===== PÁGINAS 2+: TABELA DE COLABORADORES =====
    const rowsPerPage = 28;
    const totalPages = Math.ceil(colaboradores.length / rowsPerPage);

    for (let page = 0; page < totalPages; page++) {
      pdf.addPage();
      y = drawHeader(25);
      
      // Título da lista
      pdf.setTextColor(PRIMARY_COLOR);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text(`RELAÇÃO DE VIDAS - ${competencia.toUpperCase()}`, marginLeft, y);
      y += 10;

      // Cabeçalho da tabela
      const colWidths = [55, 18, 25, 30, 25, 30]; // Nome, Sexo, Nasc, CPF, Salário, Class
      const headers = ["NOME", "SEXO", "NASCIMENTO", "CPF", "SALÁRIO", "CLASSIFICAÇÃO"];
      
      pdf.setFillColor(PRIMARY_COLOR);
      pdf.rect(marginLeft, y - 4, contentWidth, 7, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      
      let xPos = marginLeft + 2;
      headers.forEach((header, i) => {
        pdf.text(header, xPos, y);
        xPos += colWidths[i];
      });
      y += 6;

      // Linhas da tabela
      const startIndex = page * rowsPerPage;
      const endIndex = Math.min(startIndex + rowsPerPage, colaboradores.length);
      const pageColabs = colaboradores.slice(startIndex, endIndex);

      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);

      pageColabs.forEach((c, index) => {
        // Fundo alternado
        if (index % 2 === 1) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(marginLeft, y - 3, contentWidth, 6, "F");
        }

        xPos = marginLeft + 2;
        
        // Nome (truncar se muito longo)
        const nome = c.nome.length > 30 ? c.nome.substring(0, 28) + "..." : c.nome;
        pdf.text(nome, xPos, y);
        xPos += colWidths[0];

        // Sexo
        const sexo = c.sexo === "Masculino" ? "M" : c.sexo === "Feminino" ? "F" : "-";
        pdf.text(sexo, xPos, y);
        xPos += colWidths[1];

        // Nascimento
        pdf.text(formatDataPTBR(c.data_nascimento), xPos, y);
        xPos += colWidths[2];

        // CPF
        pdf.text(formatCPF(c.cpf), xPos, y);
        xPos += colWidths[3];

        // Salário
        pdf.text(formatCurrency(c.salario), xPos, y);
        xPos += colWidths[4];

        // Classificação
        const classif = c.classificacao_salario || c.classificacao || "-";
        const classifTrunc = classif.length > 18 ? classif.substring(0, 16) + "..." : classif;
        pdf.text(classifTrunc, xPos, y);

        y += 6;
      });

      // Se é a última página, mostrar total
      if (page === totalPages - 1) {
        y += 5;
        pdf.setTextColor(PRIMARY_COLOR);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.text(`Total de Vidas: ${colaboradores.length}`, pageWidth - marginRight, y, { align: "right" });
      }
    }

    return pdf;
  };

  const handleGerarESalvar = async () => {
    if (!selectedLoteId) {
      toast.error("Selecione uma competência.");
      return;
    }
    if (!apolice.trim() || !dataInicio || !dataFim) {
      toast.error("Preencha todos os campos para gerar o documento.");
      return;
    }

    const selectedLote = lotes.find((l) => l.id === selectedLoteId);
    if (!selectedLote) {
      toast.error("Lote não encontrado.");
      return;
    }

    setLoading(true);
    try {
      // 1. Buscar dados da empresa
      const { data: empresa, error: erroEmpresa } = await supabase
        .from("empresas")
        .select("*")
        .eq("id", empresaId)
        .single();
      if (erroEmpresa) throw erroEmpresa;

      // 2. Buscar colaboradores aprovados do lote selecionado
      const { data: colaboradores, error: erroColab } = await supabase
        .from("colaboradores_lote")
        .select("*")
        .eq("lote_id", selectedLoteId)
        .eq("status_seguradora", "aprovado")
        .order("nome");

      if (erroColab) throw erroColab;

      if (!colaboradores?.length) {
        toast.warning("Nenhum colaborador aprovado nesta competência.");
        setLoading(false);
        return;
      }

      // 3. Gerar PDF diretamente com jsPDF
      const pdf = await generatePdfDirectly(empresa, colaboradores, selectedLote.competencia);

      // 4. Converter para Blob e fazer upload
      const pdfBlob = pdf.output("blob");
      const fileNameBase = getFileNameFromCompetencia(selectedLote.competencia, empresa.nome);
      const fileName = `adendos/${empresaId}/${fileNameBase}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("contratos")
        .upload(fileName, pdfBlob, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // 5. Obter URL pública
      const { data: urlData } = supabase.storage.from("contratos").getPublicUrl(fileName);

      // 6. Atualizar lote com a URL do adendo
      const { error: updateError } = await supabase
        .from("lotes_mensais")
        .update({ adendo_url: urlData.publicUrl })
        .eq("id", selectedLoteId);

      if (updateError) throw updateError;

      toast.success(`Adendo de ${selectedLote.competencia} gerado e salvo com sucesso!`);
      setOpen(false);
      
      // Reset fields
      setSelectedLoteId("");
      setApolice("");
      setDataInicio("");
      setDataFim("");

      // Callback para atualizar a lista
      onAdendoGerado?.();

    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao gerar adendo: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const hasLotes = lotes.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} className="gap-2" disabled={!hasLotes}>
          <FileText className="h-4 w-4" />
          Gerar Adendo
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Gerar Adendo por Competência</DialogTitle>
          <DialogDescription>
            Selecione a competência e preencha os dados da apólice para gerar o PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Competência *</Label>
            <Select value={selectedLoteId} onValueChange={setSelectedLoteId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a competência" />
              </SelectTrigger>
              <SelectContent>
                {lotes.map((lote) => (
                  <SelectItem key={lote.id} value={lote.id}>
                    {lote.competencia}
                    {lote.adendo_url && " ✓"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Número da Apólice *</Label>
            <Input
              value={apolice}
              onChange={(e) => setApolice(e.target.value)}
              placeholder="Ex: 123456"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Início Vigência *</Label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Fim Vigência *</Label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleGerarESalvar}
            disabled={loading}
            className="bg-[#203455] hover:bg-[#2c456b]"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Gerar e Salvar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
