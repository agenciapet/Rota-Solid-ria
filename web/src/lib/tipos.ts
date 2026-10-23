export type TipoUsuario = 'adm' | 'voluntario';

export interface Usuario {
  id: number;
  nome: string;
  login: string;
  tipo: TipoUsuario;
  ativo?: boolean;
  criado_em?: string;
}

export interface Associacao {
  nome: string;
  endereco: string;
  latitude: number | null;
  longitude: number | null;
  telefone: string | null;
  email: string | null;
}

export interface Pessoa {
  id: number;
  nome: string;
  latitude: number;
  longitude: number;
  endereco: string | null;
  ponto_referencia: string | null;
  foto_url: string | null;
  telefone: string | null;
  ligar_antes_min: number | null;
  ativa: boolean;
  na_rota: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Ponto {
  lat: number;
  lng: number;
}

// ---- rota do dia ----

export type StatusParada = 'na_fila' | 'em_espera' | 'a_caminho' | 'no_local' | 'concluida' | 'nao_visitada';
export type StatusRota = 'nao_iniciada' | 'em_andamento' | 'retorno' | 'concluida';
export type Papel = 'motorista' | 'relatorio' | 'acompanhante';
export type CampoQuestionario = 'encontrada' | 'deixou_comida' | 'observacao' | 'pedido';
export type TipoAcao =
  | 'sim'
  | 'depois'
  | 'ir_agora'
  | 'trocar'
  | 'chegou'
  | 'voltar'
  | 'concluir_paragem'
  | 'iniciar_retorno'
  | 'voltar_a_rota'
  | 'concluir_rota';

/** O que a equipa vê de cada pessoa durante a rota; a ficha completa fica com o adm. */
export interface PessoaRota {
  id: number;
  nome: string;
  latitude: number;
  longitude: number;
  ponto_referencia: string | null;
  foto_url: string | null;
  telefone: string | null;
  ligar_antes_min: number | null;
}

/** Pedido feito numa rota anterior, ainda aberto ou respondido nesta paragem. */
export interface PedidoAnterior {
  id: number;
  descricao: string;
  pedido_em: string | null;
  adiamentos: number;
  a_levar: boolean;
  resposta: 'entregue' | 'adiado' | null;
}

export interface PedidoAberto {
  id: number;
  descricao: string;
  adiamentos: number;
  pessoa_id: number;
  pessoa_nome: string;
  pessoa_ativa: boolean;
  pedido_em: string | null;
}

export interface Parada {
  id: number;
  pessoa_id: number;
  posicao: number;
  status: StatusParada;
  ligacao_feita: boolean;
  encontrada: boolean | null;
  deixou_comida: boolean | null;
  observacao: string | null;
  pedido: string | null;
  motivo_nao_visita: string | null;
  chegada_em: string | null;
  concluida_em: string | null;
  /** campo → nome de quem preencheu */
  preenchido_por: Partial<Record<CampoQuestionario, string>>;
  pedidos_anteriores: PedidoAnterior[];
  pessoa: PessoaRota;
}

export interface MembroEquipe {
  usuario_id: number;
  nome: string;
  papel: Papel;
}

export interface EventoRota {
  id: number;
  tipo: string;
  usuario_id: number | null;
  usuario_nome: string | null;
  parada_id: number | null;
  dados: Record<string, unknown> | null;
  criado_em: string;
}

export interface EstadoRota {
  gerado_em: number;
  rota: {
    id: number;
    data: string;
    status: StatusRota;
    km_inicial: number;
    km_final: number | null;
    iniciada_em: string;
    concluida_em: string | null;
    versao_fila: number;
  };
  equipe: MembroEquipe[];
  paradas: Parada[];
  eventos: EventoRota[];
  associacao: { nome: string; endereco: string; latitude: number | null; longitude: number | null } | null;
}
