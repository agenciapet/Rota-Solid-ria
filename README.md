# Rota Solidária

PWA para montar e executar a rota de apoio da Associação. Especificação: [Especificação v1 — App de Rotas.md](Especificação%20v1%20—%20App%20de%20Rotas.md).

```
api/   Node.js + TypeScript + Express + MySQL (mysql2, SQL direto). WebSocket na fase 3.
web/   React + Vite + TypeScript + Tailwind + Leaflet/OpenStreetMap, instalável como PWA.
```

## Correr localmente

```bash
docker compose up -d                 # MySQL 8.4 na porta 3307

cd api
cp .env.example .env                 # preencher JWT_SECRET e FOTO_SECRET
npm install
npm run migrate
npm run criar-adm -- --nome "Nome" --login admin --senha "palavra-passe-8+"
npm run semear-demo                  # opcional: Associação, 30 pessoas fictícias e voluntários de teste
npm run dev                          # http://localhost:3001

cd ../web
cp .env.example .env
npm install
npm run dev                          # http://localhost:5173
npm test                             # testes da sugestão de posição
```

Em desenvolvimento o front chama `/api` e o Vite encaminha para a API, por isso um telemóvel na mesma rede Wi-Fi
abre o app em `http://<ip-do-mac>:5173`. Nesse modo o botão "Usar a minha localização" não funciona no telemóvel:
o navegador só dá o GPS em HTTPS ou em `localhost`.

### Contas de teste (só desenvolvimento)

| Perfil | Utilizador | Palavra-passe |
| --- | --- | --- |
| Adm | `admin` | `trocar-esta-senha` |
| Voluntário | `ana.teste`, `rui.teste`, `ines.teste` | `teste1234` |

Para repor a demonstração: apagar as pessoas (`DELETE FROM pessoas;`) e voltar a correr `npm run semear-demo`.

## Estado

| Fase | Situação |
| --- | --- |
| 1. Base: login, Associação, pessoas com mapa, foto e telefone, voluntários | Feita |
| 2. Montagem da rota: mapa numerado, lista arrastável, sugestão de posição | Feita |
| 3. Execução em tempo real: fila partilhada, Sim/Depois/Trocar, Google Maps, lembrete de ligação, questionário, retorno | Feita |
| 4. Pedidos (lista no início, lembrete ao chegar, Entregue/Adiado) e relatório com texto para o WhatsApp | Feita |
| 5. Painel do adm | A seguir |

O esquema completo das 10 tabelas já está em `api/migrations/001_esquema_inicial.sql`.

## Decisões de implementação

- **Sessão**: JWT de 30 dias no `Authorization: Bearer`, guardado no telemóvel. O utilizador é relido do banco a cada pedido, então desativar um voluntário corta o acesso na hora.
- **Fotos**: guardadas fora de qualquer pasta pública, em `api/uploads/fotos`, e servidas só com link assinado (HMAC) que expira em 1 hora. O telemóvel reduz a foto para no máximo 1600px antes de enviar.
- **RGPD**: só o adm acede às fichas (`/pessoas`). A ficha permite exportar os dados (JSON) e apagar a pessoa com todo o histórico.
- **PWA**: o service worker guarda em cache só os ficheiros do app, nunca a API nem as fotos. O app exige internet.
- **Rota modelo**: grava a cada alteração, uma gravação de cada vez, com versão (um segundo aparelho com versão antiga recebe 409 e pede para recarregar). "Desfazer" volta atrás nas últimas alterações da sessão. Pessoas pausadas mantêm o lugar na ordem, mas ficam sem número e fora da linha.
- **Sugestão de posição**: menor desvio em linha reta entre duas paragens vizinhas, contando a saída e o regresso à Associação ([web/src/lib/rota.ts](web/src/lib/rota.ts)). A inclusão abre uma prévia que só grava ao confirmar.
- **Fila em tempo real**: a API difunde o estado completo da rota por WebSocket (`/ws`, autenticado com o mesmo token) a cada alteração; o telemóvel reconecta sozinho e recarrega ao voltar ao ecrã. Cada ação envia a `versao_fila` que conhece; o servidor recusa a desatualizada com 409 e devolve o estado atual, que o telemóvel mostra com o aviso "Outra pessoa já avançou a fila". Sem ligação, o app mostra "Sem ligação" e bloqueia os botões.
- **"Depois"**: a pessoa fica em espera; quando alguém é confirmado com "Sim" (ou "Ir agora"), as adiadas voltam à fila logo abaixo dele, na ordem original. "Trocar pessoa" devolve a pessoa a caminho à posição em que estava. Se todas as que faltam estiverem em espera, o app abre a fila para a equipa escolher.
- **Questionário**: cada campo grava ao ser preenchido (sem versão da fila) e aparece aos outros com o nome de quem preencheu. "Fez algum pedido?" cria logo um pedido aberto. Só "Concluir paragem" conclui a parada; as respostas podem ser corrigidas a partir da fila até a rota ser concluída (depois, só o adm).
- **Equipa do dia**: quem inicia a rota escolhe a equipa e os papéis (precisa de um motorista e de alguém no relatório); o papel não trava nada, só destaca. Um voluntário que não esteja na equipa pode entrar como acompanhante. O adm pode sempre agir, para acompanhar e corrigir.
- **Pedidos**: "Fez algum pedido?" cria o pedido aberto. No início da rota seguinte a equipa vê os pedidos abertos e marca os que leva (`levar_rota_id`). Ao chegar à pessoa, o questionário lembra "Pediu em 28/09: cobertor" com Entregue/Adiado; tocar outra vez anula. Entregue fecha o pedido; Adiado conta um adiamento e o lembrete volta na rota seguinte. O adm cancela pedidos na ficha da pessoa.
- **Relatório**: gerado a partir do estado da rota ([web/src/lib/relatorio.ts](web/src/lib/relatorio.ts)), com uma linha por pessoa na ordem da visita e as não visitadas no fim. "Copiar texto" usa a área de transferência; sem HTTPS (rede local) mostra o texto para copiar à mão. Relatórios antigos abrem em `/relatorios/:id`.
- **Login**: o limite de 20 tentativas por 15 minutos conta só as falhadas.
- **Textos** em português de Portugal (utilizador, palavra-passe, equipa, morada).

## Publicação

- `web/` na Vercel (`vercel.json` já reencaminha as rotas para a SPA). Definir `VITE_API_URL`.
- `api/` numa VPS na UE: `npm run build && npm start`, com `CORS_ORIGINS` igual ao domínio do front. O proxy (nginx/Caddy) tem de passar o upgrade do WebSocket em `/ws`.
