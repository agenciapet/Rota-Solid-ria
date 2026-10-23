# Especificação v1 — App de Rotas

Oct 3, 2026 · @Natalia Cassus

## Resumo

Uma única PWA (Android, iPhone e web) em que o adm monta a ordem da rota num mapa e a equipe a executa numa fila compartilhada em tempo real. Na v1 não há otimização automática nem navegação dentro do app: a ordem é decisão do adm e o trajeto abre no Google Maps.

| Tema | Decisão |
| --- | --- |
| Plataforma | Uma PWA instalável; sem app nativo na v1 |
| Volume | Cerca de 30 pessoas por rota; 1 rota por dia, às segundas, quintas e sextas, sempre com a mesma lista |
| Login | Por pessoa; o celular da Associação serve para ligar às pessoas assistidas |
| Montagem da rota | Feita pelo adm, com mapa do bairro e todos os pontos cadastrados |
| Navegação | O app abre o Google Maps com o destino da parada |
| Ligações | Quem tem telefone cadastrado gera um lembrete para ligar antes da chegada |
| "Depois" | A pessoa adiada volta à fila logo depois da próxima confirmada; dois "Depois" seguidos mostram a terceira pessoa |
| Avançar a fila | O primeiro toque vale para todos; dá para trocar antes da chegada |
| Pedidos | Relatório ou Acompanhante marca "Entregue" ou "Adiado" ao passar pela pessoa |
| Relatório | Texto pronto para copiar e colar no grupo de WhatsApp; PDF por e-mail fica para a versão seguinte |
| Dados pessoais | A Associação fica em Portugal: aplica-se o RGPD |
| Sem sinal | Fora da v1; o app exige internet |
| Idioma | Textos do app em português de Portugal |

## Escopo da v1

A v1 cobre o ciclo completo de uma rota: cadastrar, montar, executar, relatar e lembrar os pedidos na rota seguinte.

**Entra**

- Cadastro de pessoas assistidas: nome, localização no mapa, ponto de referência, foto do local e telefone.
- Página da Associação: nome, endereço e contatos; o endereço é o ponto de partida e de chegada da rota.
- Montagem da rota pelo adm, com mapa e lista ordenável.
- Execução em tempo real por Motorista, Relatório e Acompanhante, com contador de total e faltantes.
- Lembrete para ligar antes da chegada a quem tem telefone cadastrado.
- Questionário por pessoa, quilometragem inicial e final, retorno à Associação.
- Pedidos com lembrete na rota seguinte.
- Relatório final com texto pronto para o WhatsApp, e painel do adm.

**Fica fora**

- Reordenação automática de toda a rota pelo sentido das ruas. Com 30 paradas, passa do limite de 25 por requisição da Routes API do Google.
- Navegação curva a curva dentro do app.
- Funcionamento sem internet.
- Notificações push e rastreamento da posição do carro.
- Relatório em PDF enviado por e-mail; fica para a versão seguinte.

## Papéis e permissões

O papel define a tela inicial e o que aparece em destaque; ele não trava a rota. Qualquer membro da equipe pode avançar a fila, para que a rota continue se um celular ficar sem bateria.

| Papel | Onde usa | O que faz |
| --- | --- | --- |
| Adm | Web ou app | Cadastra pessoas, voluntários e os dados da Associação, monta a rota, acompanha a rota ao vivo, vê relatórios e painel, corrige registros |
| Motorista | Celular | Vê a próxima pessoa, abre o trajeto no Google Maps, confirma a chegada, informa o km final; responde o questionário se o celular do Relatório desligar |
| Relatório | Celular | Marca a equipe do dia, informa o km inicial, responde o questionário, registra e baixa pedidos |
| Acompanhante | Celular | O mesmo que o Relatório |

O papel vale por rota: é definido no início, quando o Relatório marca a equipe do dia, e não fica fixo na conta do voluntário.

Cada voluntário entra com o próprio login, no próprio celular. O celular da Associação fica para as ligações às pessoas assistidas.

## Montagem da rota

A tela de montagem mostra o mapa do bairro com todas as pessoas cadastradas e a lista na ordem da rota, lado a lado. No celular, o mapa fica em cima e a lista embaixo.

**No mapa**

- Cada pessoa da rota é um marcador com o número da sua posição.
- Uma linha liga os marcadores na ordem, saindo da Associação e voltando a ela.
- Pessoas cadastradas que estão fora da rota aparecem em outra cor, sem número.
- Tocar num marcador destaca a pessoa na lista, e o contrário também.

**Na lista**

- Arrastar uma pessoa muda a posição; os números e a linha do mapa atualizam na hora.
- Cada linha mostra nome, ponto de referência e miniatura da foto.
- Uma pessoa pode ser pausada sem perder o histórico.

**Ao incluir uma pessoa nova**

1. O adm marca o ponto: toca no mapa, usa a localização atual do celular ou cola as coordenadas.
2. O sistema sugere a posição: entre as duas paradas vizinhas em que o desvio é menor.
3. O mapa mostra a prévia com a pessoa já encaixada.
4. O adm aceita ou arrasta para outra posição.

A sugestão usa distância em linha reta, então não enxerga rua de mão única nem rua sem saída. Por isso a decisão final é do adm, olhando o mapa.

A ordem montada é a **rota modelo**. Cada dia de rota copia a rota modelo no momento em que começa; o que acontece na execução ("Depois", trocas) não altera o modelo.

Há uma única rota modelo, usada nas segundas, quintas e sextas. Quando algo muda, o adm ajusta o modelo e a rota seguinte já sai com a nova ordem.

## Execução da rota

A fila fica no servidor e é a mesma para todos os celulares: cada toque aparece para a equipe inteira em cerca de um segundo.

&#91;embedded content: fluxo de uma parada · 6 etapas, 1 decisão\]

"Depois" e "Trocar pessoa" devolvem a pessoa à fila; só o questionário salvo conclui a parada e puxa a seguinte.

**Passo a passo**

1. O Relatório inicia a rota: marca a equipe do dia e informa o km inicial.
2. O app mostra a próxima pessoa, com ponto de referência e foto, e os botões **Sim** e **Depois**.
3. **Sim**: a pessoa fica "A caminho" para todos. O Motorista toca em "Abrir no Google Maps".
4. **Chegou ao local?** Ao confirmar, o questionário abre para Relatório e Acompanhante.
5. Questionário salvo: a parada é concluída e o app mostra a próxima pessoa.
6. Fila vazia: o destino passa a ser a Associação, com a lista de devolução (celular, chaves, isopor, coletes) e o km final.
7. Rota concluída: o relatório é gerado.

O topo da tela mostra sempre o contador, no formato "12 de 30 visitadas · faltam 18".

**Lembrete de ligação**

- Quem tem telefone cadastrado aparece com o aviso "Ligar antes de chegar" e o número, nas telas Próxima pessoa e A caminho.
- Cada pessoa pode ter uma antecedência em minutos. Exemplo: quem precisa de 10 minutos para chegar ao ponto de encontro.
- Com antecedência cadastrada, o aviso aparece já na parada anterior: "A seguir: João. Ligar agora, ele pede 10 minutos."
- Tocar no número copia para discar no celular da Associação, ou inicia a ligação no próprio aparelho.
- Quem ligou marca "Ligação feita" e o aviso some para toda a equipe.
- O aviso segue a fila: se a ordem mudar com "Depois" ou "Trocar pessoa", vale para quem passou a ser a próxima.

O app não rastreia o carro, então não calcula os 10 minutos sozinho. O aviso na parada anterior é o que garante a antecedência.

**Como funciona o "Depois"**

- A pessoa adiada fica em espera e o app mostra a seguinte.
- Quando alguém é confirmado com "Sim", as adiadas voltam para a fila logo abaixo dele, na ordem original.
- Exemplo: fila A, B, C. "Depois" em A mostra B; "Sim" em B deixa a fila em B, A, C.
- Sem essa regra, dois "Depois" seguidos voltariam para a primeira pessoa, em círculo.
- Se todas as que faltam estiverem em espera, o app abre a fila para a equipe escolher.

**Como trocar o próximo**

- Enquanto a pessoa está "A caminho", todos veem o botão **Trocar pessoa**. Ele devolve a pessoa à posição em que estava e abre a fila para escolher outra.
- O botão **Ver fila** está sempre disponível: mostra quem falta e permite tocar em "Ir agora" em qualquer pessoa.
- Depois de "Chegou", o botão **Voltar** desfaz a chegada, caso tenha sido engano.
- As respostas do questionário podem ser corrigidas até a rota ser concluída; depois disso, só pelo adm.
- Toda troca fica registrada com nome e hora, e a equipe vê um aviso curto: "Ana trocou a próxima para João".

**Toques simultâneos e falhas**

- Se duas pessoas tocam ao mesmo tempo, vale o primeiro toque. O segundo celular recebe a tela atualizada e um aviso.
- No questionário, cada campo salva ao ser preenchido e aparece para os outros com o nome de quem preencheu.
- Nada fica guardado só no aparelho. Se um celular desligar, outro membro continua do mesmo ponto.
- Sem internet, o app mostra "Sem conexão" e bloqueia os botões até o sinal voltar.
- A equipe pode encerrar a rota com pessoas ainda na fila; o app pede o motivo e elas entram no relatório como "Não visitada".

## Questionário e pedidos

Cada parada tem um único questionário, compartilhado por toda a equipe. Relatório e Acompanhante respondem; o Motorista responde se o celular do Relatório desligar.

| Pergunta | Resposta |
| --- | --- |
| Foi encontrada no local? | Sim ou Não |
| Deixou a comida? | Sim ou Não |
| Observação | Texto livre, opcional |
| Fez algum pedido? | Texto livre, opcional; cria um pedido aberto |

**Ciclo do pedido**

1. O pedido nasce no questionário e fica **aberto**.
2. No início da rota seguinte, a equipe vê a lista de pedidos abertos e marca o que está levando.
3. Ao chegar na pessoa, o questionário abre com o lembrete no topo: "Pediu em 28/09: cobertor".
4. Relatório ou Acompanhante responde **Entregue** ou **Adiado**.
5. **Entregue** fecha o pedido. **Adiado** mantém aberto e o lembrete volta na próxima rota.

Se a pessoa não for encontrada, o pedido continua aberto sem precisar de resposta. O adm pode cancelar um pedido que não será atendido.

## Relatório final e painel do adm

O relatório é gerado quando a rota é concluída e fica disponível para a equipe e para o adm.

**Relatório da rota**

- Cabeçalho: data, equipe, km inicial, km final e distância total (final menos inicial).
- Totais: visitadas, encontradas, não encontradas, comidas entregues.
- Uma linha por pessoa: nome, status (encontrada, não encontrada, não visitada), observação.
- Destaque visual nas pessoas que fizeram pedido, com o texto do pedido.
- Pedidos entregues e adiados nesta rota.

**Mensagem para o WhatsApp**

- A tela do relatório tem o botão **Copiar texto**, que copia o resumo já formatado para colar no grupo.
- O envio é manual: o app não publica no grupo.
- O texto traz os totais e uma linha por pessoa, na ordem da visita: estado, observação e pedido em destaque.

Exemplo do texto copiado, com nomes fictícios:

```
*Rota 05/10* (segunda)
Equipa: Ana (motorista), Rui (relatório), Inês (acompanhante)
Km: 45.210 a 45.238 · 28 km
Visitadas: 28 de 30 · Encontradas: 24 · Comidas entregues: 24

1. João · encontrado · comida entregue
2. Maria · não encontrada
3. Teresa · encontrada · comida entregue · *Pedido: cobertor*
4. Manuel · encontrado · comida entregue · Obs.: mudou para a porta ao lado
5. António · encontrado · comida entregue · Pedido entregue: meias
6. Carlos · não visitado (rua cortada)
(segue até a 30.ª pessoa)
```

**Painel do adm**

- Rota em andamento, ao vivo: quem já foi visitado e quem falta.
- Histórico de rotas: data, equipe, km, encontradas sobre o total.
- Pessoas assistidas: ativas, pausadas e visitadas no período.
- Pedidos abertos, com a idade de cada um em número de rotas.
- Pessoas não encontradas em várias rotas seguidas.
- Quilômetros rodados por mês.

## Modelo de dados

São dez tabelas. A separação entre rota modelo e rota executada é o que permite mexer na fila do dia sem estragar a ordem montada pelo adm.

| Tabela | Campos principais | Para que serve |
| --- | --- | --- |
| `associacao` | nome, endereço, latitude, longitude, telefone, e-mail | Dados da Associação; ponto de partida e de chegada |
| `usuarios` | id, nome, login, senha (hash), tipo (adm ou voluntário), ativo | Quem entra no sistema; um login por pessoa |
| `pessoas` | id, nome, latitude, longitude, endereço em texto, ponto de referência, foto, telefone, ligar\_antes\_min, ativa | Pessoas assistidas |
| `rotas_modelo` | id, nome | A rota montada pelo adm; hoje existe uma só |
| `rota_modelo_itens` | rota\_modelo\_id, pessoa\_id, posição | A ordem da rota modelo |
| `rotas` | id, rota\_modelo\_id, data, status, km\_inicial, km\_final, iniciada\_em, concluída\_em, versão\_fila | Cada rota executada |
| `rota_equipe` | rota\_id, usuario\_id, papel (motorista, relatório, acompanhante) | Equipe do dia |
| `paradas` | id, rota\_id, pessoa\_id, posição, status, ligação\_feita, encontrada, deixou\_comida, observação, motivo\_não\_visita, chegada\_em, concluída\_em, preenchido\_por | A fila do dia e as respostas do questionário |
| `pedidos` | id, pessoa\_id, descrição, status (aberto, entregue, cancelado), parada de origem, parada de entrega, adiamentos | Pedidos e seus lembretes |
| `eventos_rota` | id, rota\_id, usuario\_id, tipo, parada\_id, dados, criado\_em | Registro de cada toque: Sim, Depois, troca, chegada, ligação |

**Estados**

- Rota: não iniciada, em andamento, retorno à Associação, concluída.
- Parada: na fila, em espera, a caminho, no local, concluída, não visitada.

O campo `versão_fila` resolve os toques simultâneos: cada ação envia a versão que o celular conhece, e o servidor recusa a que chegar desatualizada.

## Telas

São doze telas: o login, quatro só do adm e sete usadas na rota.

| Tela | Quem usa | O que tem |
| --- | --- | --- |
| Login | Todos | Entrada com login e senha, um por pessoa |
| Associação | Adm | Nome, endereço, contatos e ponto no mapa |
| Pessoas | Adm | Lista e ficha: nome, ponto no mapa, referência, foto, telefone, antecedência da ligação, histórico de visitas e pedidos |
| Montagem da rota | Adm | Mapa com marcadores numerados e lista arrastável |
| Painel | Adm | Rota ao vivo, histórico e indicadores |
| Início da rota | Relatório | Equipe do dia, km inicial, pedidos abertos |
| Próxima pessoa | Equipe | Nome, referência, foto, aviso de ligação, Sim e Depois, contador |
| A caminho | Equipe | Abrir no Google Maps, aviso de ligação, Chegou ao local?, Trocar pessoa |
| Questionário | Equipe | Lembrete de pedido, as quatro perguntas e o aviso de ligação da parada seguinte |
| Fila | Equipe | Quem falta, quem está em espera, quem já foi visitado |
| Retorno à Associação | Equipe | Lista de devolução, km final e motivo das não visitadas |
| Relatório da rota | Equipe e adm | Resumo, pessoas, pedidos, distância e botão Copiar texto |

Os textos de botões e avisos citados neste documento estão em português do Brasil. No app, ficam em português de Portugal: telemóvel, morada, equipa, ligação.

## Stack, mapas e custos

Nenhuma API paga é necessária na v1; o custo recorrente é só hospedagem.

| Camada | Escolha | Motivo |
| --- | --- | --- |
| Front | PWA em React, ou no framework que você já usa, hospedada na Vercel | Um código para Android, iPhone e web |
| API | Node.js em VPS | Mantém a conexão aberta que o tempo real exige |
| Tempo real | WebSocket | Entrega cada toque à equipe e reconecta sozinho |
| Banco | MySQL | Transações garantem a ordem da fila |
| Mapa da montagem | Leaflet ou MapLibre sobre base OpenStreetMap | Sem licença paga; marcadores numerados e arrastar funcionam bem |
| Navegação | Link do Google Maps com as coordenadas do destino | Não exige chave de API e abre o app do Maps no Android e no iPhone |
| Fotos | Arquivos privados no servidor, com link temporário | A foto do local não pode ficar pública |

**Custos**

- Recorrente: VPS e domínio. A Vercel e a base de mapa têm planos gratuitos que devem cobrir este volume; confirme os limites antes de publicar.
- Google: zero na v1.
- O custo real é o desenvolvimento, estimado na seção seguinte.

**Dados pessoais**

O cadastro guarda nome, localização e foto do local de pessoas em situação vulnerável.

- O voluntário vê só a rota do dia; ficha completa e histórico ficam com o adm.
- Fotos, telefones e demais dados ficam atrás de login, sem links públicos.
- O adm consegue exportar e apagar os dados de uma pessoa.
- A Associação fica em Portugal, então aplica-se o RGPD.
- Hospedar o banco e as fotos em servidor na União Europeia evita a transferência de dados para fora dela.
- A base legal do tratamento e a forma de informar as pessoas assistidas são decisões da Associação; vale validar com apoio jurídico.

## Ordem de construção

São cinco fases, de 6 a 7 semanas de trabalho para uma pessoa em dedicação integral usando Claude Code. É uma estimativa aproximada, não um orçamento.

1. **Base** (cerca de 1 semana): login por pessoa, tipos de usuário, página da Associação, cadastro de pessoas com ponto no mapa, foto e telefone.
2. **Montagem da rota** (cerca de 1 semana): mapa com marcadores numerados, lista arrastável, sugestão de posição.
3. **Execução** (2 a 3 semanas): fila em tempo real, Sim, Depois, Trocar, Abrir no Google Maps, lembrete de ligação, Chegou, contador, km e retorno.
4. **Questionário, pedidos e relatório** (cerca de 1 semana), incluindo o texto para o WhatsApp.
5. **Painel do adm** (cerca de 1 semana).

A fase 3 concentra o risco: é onde aparecem os toques simultâneos, a queda de conexão e a troca de celular. Vale testá-la com dois ou três celulares antes de seguir.

Como a rota real só acontece três vezes por semana, reserve mais duas a três semanas de calendário para ajustes em campo.

**Depois da v1:** reordenação automática considerando o sentido das ruas, funcionamento sem sinal, notificações e relatório em PDF enviado por e-mail.

## Pontos em aberto

Não há pontos em aberto: todas as perguntas foram respondidas e estão incorporadas acima.

## Fontes

- [Maps URLs, Google](https://developers.google.com/maps/documentation/urls/get-started): link de navegação sem chave de API.
- [Set intermediate waypoints, Routes API, Google](https://developers.google.com/maps/documentation/routes/intermed_waypoints): limite de 25 paradas intermediárias por requisição.
