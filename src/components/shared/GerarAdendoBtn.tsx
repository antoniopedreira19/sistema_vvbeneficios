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
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// URL DA LOGO
const LOGO_URL =
  "https://gkmobhbmgxwrpuucoykn.supabase.co/storage/v1/object/public/MainBucket/Gemini_Generated_Image_c0slgsc0slgsc0sl-removebg-preview.png";

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

  const generateHtml = (empresa: any, colaboradores: any[], competencia: string) => {
    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Adendo Contratual - ${empresa.nome} - ${competencia}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          
          * { margin: 0; padding: 0; box-sizing: border-box; }
          
          body { 
            font-family: 'Inter', sans-serif; 
            color: #333; 
            line-height: 1.4; 
            font-size: 13px; 
            background: white;
            padding: 20px;
          }
          
          .page {
            width: 210mm;
            min-height: 297mm;
            padding: 15mm 20mm;
            background: white;
            margin: 0 auto;
          }

          .page-one-container {
            display: flex;
            flex-direction: column;
            min-height: calc(297mm - 30mm);
          }

          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            border-bottom: 2px solid #203455; 
            padding-bottom: 15px; 
            margin-bottom: 30px; 
          }
          .header-title { 
            color: #203455; 
            font-weight: 700; 
            font-size: 14px; 
            text-transform: uppercase; 
          }
          .logo { 
            width: 90px;
            height: auto; 
            object-fit: contain; 
          }
          
          .date { text-align: right; margin-bottom: 25px; font-size: 12px; color: #666; }
          
          .content-block { margin-bottom: 20px; }
          .label { font-weight: 700; color: #000; margin-right: 5px; }
          
          .text-justify { text-align: justify; margin-bottom: 15px; }

          .section-title { 
            color: #203455; 
            font-weight: 700; 
            font-size: 14px; 
            margin-top: 25px; 
            margin-bottom: 10px; 
            text-transform: uppercase; 
            border-left: 4px solid #203455;
            padding-left: 10px;
          }

          .spacer { flex-grow: 1; }

          .signature-wrapper {
            width: 100%;
            text-align: center;
            margin-top: 40px;
            margin-bottom: 10px;
          }
          .signature-line { 
            border-top: 1px solid #000; 
            width: 350px; 
            margin: 0 auto 5px auto; 
          }
          .signature-role { font-weight: 700; font-size: 12px; text-transform: uppercase; }
          .signature-desc { font-size: 11px; margin-top: 2px; }

          .page-break { page-break-before: always; margin-top: 20px; }
          .list-title { 
            font-size: 14px; 
            font-weight: 700; 
            color: #203455; 
            margin: 20px 0 10px 0; 
            text-transform: uppercase;
          }
          
          table { 
            width: 100%; 
            border-collapse: collapse; 
            font-size: 11px; 
            border: 1px solid #e2e8f0;
          }
          th { 
            background-color: #203455; 
            color: white; 
            padding: 8px; 
            text-align: left; 
            text-transform: uppercase;
            font-weight: 600;
            border: 1px solid #1e293b;
          }
          td { 
            padding: 8px; 
            border: 1px solid #e2e8f0; 
            color: #333;
          }
          tr:nth-child(even) { background-color: #f8fafc; }
          
          .total-row { 
            text-align: right; 
            font-weight: 700; 
            padding: 10px 0; 
            font-size: 12px; 
            color: #203455; 
          }
          
          .text-center { text-align: center; }
          .text-right { text-align: right; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="page-one-container">
            
            <div class="header">
              <div class="header-title">SEGURO DE ACIDENTES PESSOAIS COLETIVO</div>
              <img src="${LOGO_URL}" class="logo" alt="Logo VV" crossorigin="anonymous" />
            </div>

            <div class="date">${getDataAtualExtenso()}</div>

            <div class="content-block">
              <div><span class="label">ESTIPULANTE:</span> VV BENEFICIOS E CONSULTORIA LTDA</div>
              <div><span class="label">CNPJ Nº:</span> 56.967.823/0001-45</div>
              <div><span class="label">Email:</span> contato@vvbeneficios.com.br</div>
              <div><span class="label">Telefone:</span> (71) 99692-8880</div>
              <div><span class="label">APÓLICE Nº:</span> ${apolice}</div>
              <div><span class="label">CORRETOR:</span> GERSON BARTH PORTNOI</div>
              <div><span class="label">COMPETÊNCIA:</span> ${competencia}</div>
            </div>

            <div class="text-justify">
              Pelo presente documento, que passa a integrar a apólice nº <strong>${apolice}</strong> 
              fica acordada entre as partes contratantes deste seguro que: A empresa mencionada está ativa e regular nesta apólice.
            </div>

            <div class="text-justify">
              <strong>Vigência:</strong> ${formatDataPTBR(dataInicio)} a ${formatDataPTBR(dataFim)} 
              inclui-se o seguinte subestipulante:
            </div>

            <div class="section-title">DADOS DA EMPRESA</div>
            <div class="content-block">
              <div><span class="label">Nome:</span> ${empresa.nome.toUpperCase()}</div>
              <div><span class="label">CNPJ:</span> ${formatCNPJ(empresa.cnpj)}</div>
              <div><span class="label">Endereço:</span> ${empresa.endereco || "Não informado"}</div>
            </div>

            <div class="spacer"></div>

            <div class="signature-wrapper">
              <div class="signature-line"></div>
              <div class="signature-role">Estipulante</div>
              <div class="signature-desc">Assinatura do Representante Legal</div>
            </div>

          </div>
        </div>

        <div class="page">
          <div class="header">
            <div class="header-title">SEGURO DE ACIDENTES PESSOAIS COLETIVO</div>
            <img src="${LOGO_URL}" class="logo" alt="Logo VV" crossorigin="anonymous" />
          </div>

          <div class="list-title">RELAÇÃO DE VIDAS - ${competencia}</div>

          <table>
            <thead>
              <tr>
                <th width="35%">NOME</th>
                <th width="10%" class="text-center">SEXO</th>
                <th width="15%" class="text-center">NASCIMENTO</th>
                <th width="15%" class="text-center">CPF</th>
                <th width="12%" class="text-right">SALÁRIO</th>
                <th width="13%">CLASSIFICAÇÃO</th>
              </tr>
            </thead>
            <tbody>
              ${colaboradores
                .map(
                  (c) => `
                <tr>
                  <td>${c.nome}</td>
                  <td class="text-center">${c.sexo || "-"}</td>
                  <td class="text-center">${formatDataPTBR(c.data_nascimento)}</td>
                  <td class="text-center">${formatCPF(c.cpf)}</td>
                  <td class="text-right">${formatCurrency(c.salario)}</td>
                  <td>${c.classificacao_salario || c.classificacao || "-"}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>

          <div class="total-row">
            Total de Vidas: ${colaboradores.length}
          </div>
        </div>
      </body>
      </html>
    `;
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

      // 3. Gerar HTML e renderizar em iframe oculto
      const htmlContent = generateHtml(empresa, colaboradores, selectedLote.competencia);

      // Criar iframe oculto para renderizar o HTML
      const iframe = document.createElement("iframe");
      iframe.style.position = "absolute";
      iframe.style.left = "-9999px";
      iframe.style.top = "-9999px";
      iframe.style.width = "210mm";
      iframe.style.height = "auto";
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error("Erro ao criar iframe");

      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      // Aguardar carregamento de fontes e imagens
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // 4. Capturar com html2canvas
      const pages = iframeDoc.querySelectorAll(".page");
      const pdf = new jsPDF("p", "mm", "a4");

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i] as HTMLElement;
        const canvas = await html2canvas(page, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (i > 0) {
          pdf.addPage();
        }
        pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);
      }

      // Limpar iframe
      document.body.removeChild(iframe);

      // 5. Converter para Blob e fazer upload
      const pdfBlob = pdf.output("blob");
      const competenciaSlug = selectedLote.competencia.replace("/", "-");
      const fileName = `adendos/${empresaId}/${competenciaSlug}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("contratos")
        .upload(fileName, pdfBlob, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // 6. Obter URL pública
      const { data: urlData } = supabase.storage.from("contratos").getPublicUrl(fileName);

      // 7. Atualizar lote com a URL do adendo
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

  // Se não há lotes disponíveis, mostrar botão desabilitado
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
