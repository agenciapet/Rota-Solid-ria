-- Esquema da v1 (10 tabelas). A separação entre rota modelo e rota executada
-- permite mexer na fila do dia sem estragar a ordem montada pelo adm.

CREATE TABLE associacao (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  nome VARCHAR(150) NOT NULL,
  endereco VARCHAR(255) NOT NULL DEFAULT '',
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  telefone VARCHAR(40) NULL,
  email VARCHAR(150) NULL,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT associacao_unica CHECK (id = 1)
);

CREATE TABLE usuarios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  login VARCHAR(60) NOT NULL,
  senha_hash VARCHAR(100) NOT NULL,
  tipo ENUM('adm','voluntario') NOT NULL DEFAULT 'voluntario',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY usuarios_login (login)
);

CREATE TABLE pessoas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  endereco VARCHAR(255) NULL,
  ponto_referencia VARCHAR(255) NULL,
  foto VARCHAR(100) NULL,
  telefone VARCHAR(40) NULL,
  ligar_antes_min SMALLINT UNSIGNED NULL,
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE rotas_modelo (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL
);

CREATE TABLE rota_modelo_itens (
  rota_modelo_id INT UNSIGNED NOT NULL,
  pessoa_id INT UNSIGNED NOT NULL,
  posicao SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (rota_modelo_id, pessoa_id),
  KEY rmi_posicao (rota_modelo_id, posicao),
  CONSTRAINT rmi_modelo FOREIGN KEY (rota_modelo_id) REFERENCES rotas_modelo(id) ON DELETE CASCADE,
  CONSTRAINT rmi_pessoa FOREIGN KEY (pessoa_id) REFERENCES pessoas(id) ON DELETE CASCADE
);

CREATE TABLE rotas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  rota_modelo_id INT UNSIGNED NOT NULL,
  data DATE NOT NULL,
  status ENUM('nao_iniciada','em_andamento','retorno','concluida') NOT NULL DEFAULT 'nao_iniciada',
  km_inicial INT UNSIGNED NULL,
  km_final INT UNSIGNED NULL,
  iniciada_em DATETIME NULL,
  concluida_em DATETIME NULL,
  versao_fila INT UNSIGNED NOT NULL DEFAULT 0,
  KEY rotas_data (data),
  CONSTRAINT rotas_modelo_fk FOREIGN KEY (rota_modelo_id) REFERENCES rotas_modelo(id)
);

CREATE TABLE rota_equipe (
  rota_id INT UNSIGNED NOT NULL,
  usuario_id INT UNSIGNED NOT NULL,
  papel ENUM('motorista','relatorio','acompanhante') NOT NULL,
  PRIMARY KEY (rota_id, usuario_id),
  CONSTRAINT re_rota FOREIGN KEY (rota_id) REFERENCES rotas(id) ON DELETE CASCADE,
  CONSTRAINT re_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE paradas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  rota_id INT UNSIGNED NOT NULL,
  pessoa_id INT UNSIGNED NOT NULL,
  posicao SMALLINT UNSIGNED NOT NULL,
  status ENUM('na_fila','em_espera','a_caminho','no_local','concluida','nao_visitada') NOT NULL DEFAULT 'na_fila',
  ligacao_feita BOOLEAN NOT NULL DEFAULT FALSE,
  encontrada BOOLEAN NULL,
  deixou_comida BOOLEAN NULL,
  observacao TEXT NULL,
  motivo_nao_visita VARCHAR(255) NULL,
  chegada_em DATETIME NULL,
  concluida_em DATETIME NULL,
  -- Quem preencheu cada campo do questionário: {"encontrada": 3, "observacao": 5}
  preenchido_por JSON NULL,
  UNIQUE KEY paradas_rota_pessoa (rota_id, pessoa_id),
  KEY paradas_fila (rota_id, posicao),
  CONSTRAINT paradas_rota FOREIGN KEY (rota_id) REFERENCES rotas(id) ON DELETE CASCADE,
  CONSTRAINT paradas_pessoa FOREIGN KEY (pessoa_id) REFERENCES pessoas(id) ON DELETE CASCADE
);

CREATE TABLE pedidos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  pessoa_id INT UNSIGNED NOT NULL,
  descricao VARCHAR(500) NOT NULL,
  status ENUM('aberto','entregue','cancelado') NOT NULL DEFAULT 'aberto',
  parada_origem_id INT UNSIGNED NULL,
  parada_entrega_id INT UNSIGNED NULL,
  adiamentos SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY pedidos_pessoa_status (pessoa_id, status),
  CONSTRAINT pedidos_pessoa FOREIGN KEY (pessoa_id) REFERENCES pessoas(id) ON DELETE CASCADE,
  CONSTRAINT pedidos_origem FOREIGN KEY (parada_origem_id) REFERENCES paradas(id) ON DELETE SET NULL,
  CONSTRAINT pedidos_entrega FOREIGN KEY (parada_entrega_id) REFERENCES paradas(id) ON DELETE SET NULL
);

CREATE TABLE eventos_rota (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  rota_id INT UNSIGNED NOT NULL,
  usuario_id INT UNSIGNED NULL,
  tipo VARCHAR(40) NOT NULL,
  parada_id INT UNSIGNED NULL,
  dados JSON NULL,
  criado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY eventos_rota_idx (rota_id, criado_em),
  CONSTRAINT ev_rota FOREIGN KEY (rota_id) REFERENCES rotas(id) ON DELETE CASCADE,
  CONSTRAINT ev_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT ev_parada FOREIGN KEY (parada_id) REFERENCES paradas(id) ON DELETE SET NULL
);

-- Há uma única rota modelo, usada nas segundas, quintas e sextas.
INSERT INTO rotas_modelo (id, nome) VALUES (1, 'Rota principal');
