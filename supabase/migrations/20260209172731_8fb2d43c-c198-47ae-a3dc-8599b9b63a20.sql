
ALTER TABLE public.notas_fiscais
ADD COLUMN nf_emitida_em timestamp with time zone,
ADD COLUMN boleto_gerado_em timestamp with time zone,
ADD COLUMN pago_em timestamp with time zone;
