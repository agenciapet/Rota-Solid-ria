-- Cada gravação da ordem incrementa a versão; um aparelho com versão antiga recebe 409 em vez de sobrescrever.
ALTER TABLE rotas_modelo
  ADD COLUMN versao INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN atualizado_em DATETIME NULL;
