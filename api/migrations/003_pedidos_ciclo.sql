-- Ciclo do pedido: marcado "a levar" no início de uma rota; respondido (entregue/adiado) numa paragem.
ALTER TABLE pedidos
  ADD COLUMN levar_rota_id INT UNSIGNED NULL,
  ADD COLUMN resposta ENUM('entregue', 'adiado') NULL,
  ADD COLUMN resposta_parada_id INT UNSIGNED NULL,
  ADD CONSTRAINT pedidos_levar_rota FOREIGN KEY (levar_rota_id) REFERENCES rotas(id) ON DELETE SET NULL,
  ADD CONSTRAINT pedidos_resposta_parada FOREIGN KEY (resposta_parada_id) REFERENCES paradas(id) ON DELETE SET NULL;
