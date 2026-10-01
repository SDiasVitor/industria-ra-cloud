/* =========================================================================
   Sistema de Apoio à Manutenção Industrial — WebAR
   Ativo: Torno Convencional TC-01
   -------------------------------------------------------------------------
   Fluxo principal:
     MindAR reconhece o target  ->  âncoras 3D acompanham o torno
     a cada quadro: posição 3D da âncora -> projeção na tela -> move o botão
     toque (pointerup) no hotspot -> painel estático OU fetch() na API Flask
   Valores de telemetria/manutenção são SIMULADOS (fins didáticos).
   ========================================================================= */

const { ID_EQUIPAMENTO, API_BASE, TIMEOUT_MS, INTERVALO_ATUALIZACAO_MS, DEBUG } = window.CONFIG;

/* -------------------------------------------------------------------------
   1. DEFINIÇÃO DOS HOTSPOTS
   posicao: coordenadas no espaço do target do MindAR.
     x: -0.5 (borda esquerda da imagem) ... +0.5 (borda direita)
     y: metade da altura da imagem (proporção altura/largura). Ex.: foto 2:1 -> -0.25 ... +0.25
     Ajuste os valores conforme a foto usada como target (use ?debug=1).
   tipo: "estatico" -> conteúdo fica no frontend
         "api"      -> conteúdo vem da API Flask
   ------------------------------------------------------------------------- */
const HOTSPOTS = [
  {
    id: "cabecote",
    titulo: "Cabeçote e Placa",
    rotulo: "Cabeçote",
    tipo: "estatico",
    posicao: { x: -0.33, y: 0.07 },
    conteudo: `
      <p>O <strong>cabeçote fixo</strong> abriga o eixo-árvore e a caixa de engrenagens que definem a
      rotação. Na ponta do eixo fica a <strong>placa universal de 3 castanhas</strong>, que prende e gira a peça.</p>
      <h3>Pontos de inspeção</h3>
      <ul>
        <li>Nível de óleo do cabeçote pelo visor</li>
        <li>Ruídos anormais nas engrenagens durante a troca de rotação</li>
        <li>Desgaste e limpeza das castanhas</li>
      </ul>
      <p class="nota">Só troque a rotação com a máquina totalmente parada.</p>`,
  },
  {
    id: "carro",
    titulo: "Carro e Porta-ferramenta",
    rotulo: "Carro",
    tipo: "estatico",
    posicao: { x: 0.02, y: 0.0 },
    conteudo: `
      <p>Conjunto que desloca a ferramenta de corte: <strong>carro longitudinal</strong> (desliza sobre o
      barramento), <strong>carro transversal</strong> e <strong>carro superior</strong> com o
      <strong>porta-ferramenta</strong>. Pode ser movido manualmente ou pelo avanço automático (vara e fuso).</p>
      <h3>Pontos de inspeção</h3>
      <ul>
        <li>Folga nos carros transversal e superior</li>
        <li>Fixação correta da ferramenta no porta-ferramenta</li>
        <li>Lubrificação das guias e limpeza de cavacos</li>
      </ul>`,
  },
  {
    id: "contraponto",
    titulo: "Contraponto",
    rotulo: "Contraponto",
    tipo: "estatico",
    posicao: { x: 0.31, y: 0.05 },
    conteudo: `
      <p>Fica do lado oposto ao cabeçote e desliza sobre o barramento. Apoia peças longas com a
      <strong>ponta</strong> e também é usado para <strong>furar</strong> com mandril e broca.</p>
      <h3>Pontos de inspeção</h3>
      <ul>
        <li>Travamento firme no barramento</li>
        <li>Alinhamento com o eixo-árvore</li>
        <li>Estado do mangote e da ponta</li>
      </ul>`,
  },
  {
    id: "protecao",
    titulo: "Proteção e Segurança",
    rotulo: "Segurança",
    tipo: "estatico",
    posicao: { x: -0.18, y: 0.12 },
    conteudo: `
      <p>A <strong>proteção da placa</strong> evita contato com partes girantes e projeção de cavacos.
      O <strong>botão de emergência</strong> interrompe imediatamente o movimento.</p>
      <h3>Antes de operar</h3>
      <ul>
        <li>Nunca deixe a chave de aperto presa na placa</li>
        <li>Use óculos de proteção; não use luvas perto de partes girantes</li>
        <li>Cabelos presos, sem anéis, relógios ou mangas soltas</li>
        <li>Confirme que a proteção está fechada e a emergência funciona</li>
      </ul>`,
  },
  {
    id: "manutencao",
    titulo: "Manutenção",
    rotulo: "Manutenção",
    tipo: "api",
    endpoint: `/api/equipamentos/${ID_EQUIPAMENTO}/manutencao`,
    posicao: { x: 0.12, y: -0.12 },
  },
  {
    id: "monitoramento",
    titulo: "Monitoramento",
    rotulo: "Monitoramento",
    tipo: "api",
    endpoint: `/api/equipamentos/${ID_EQUIPAMENTO}/telemetria`,
    posicao: { x: -0.37, y: -0.09 },
    atualizaSozinho: true,
  },
];

/* -------------------------------------------------------------------------
   2. REFERÊNCIAS DO DOM
   ------------------------------------------------------------------------- */
const cena = document.getElementById("cena");
const alvo = document.getElementById("alvo");
const camada = document.getElementById("camada-hotspots");
const mira = document.getElementById("mira");
const estado = document.getElementById("estado");
const estadoTexto = document.getElementById("estado-texto");
const avisoGeral = document.getElementById("aviso-geral");

const painel = document.getElementById("painel");
const painelNumero = document.getElementById("painel-numero");
const painelTitulo = document.getElementById("painel-titulo");
const painelConteudo = document.getElementById("painel-conteudo");
const painelFonte = document.getElementById("painel-fonte");

let rastreando = false;      // target está sendo visto?
let hotspotAberto = null;    // hotspot cujo painel está aberto
let temporizador = null;     // atualização automática do monitoramento
let ultimaTelemetria = null; // para destacar valores que mudaram

/* -------------------------------------------------------------------------
   3. CRIAÇÃO DOS HOTSPOTS (âncora 3D + botão no DOM)
   ------------------------------------------------------------------------- */
HOTSPOTS.forEach((h, i) => {
  h.numero = i + 1;

  // Âncora 3D: entidade vazia filha do target -> acompanha o tracking
  const ancora = document.createElement("a-entity");
  ancora.setAttribute("position", `${h.posicao.x} ${h.posicao.y} 0`);
  alvo.appendChild(ancora);
  h.ancora = ancora;

  // Botão 2D que será reposicionado sobre a projeção da âncora
  const botao = document.createElement("button");
  botao.className = `hotspot ${h.tipo === "api" ? "hotspot--api" : ""}`;
  botao.setAttribute("aria-label", h.titulo);
  botao.innerHTML = `
    <span class="hotspot__ponto">${h.numero}</span>
    <span class="hotspot__rotulo">${h.rotulo}${
      DEBUG ? ` <em>(${h.posicao.x}, ${h.posicao.y})</em>` : ""
    }</span>`;
  // pointerup funciona igual para dedo, caneta e mouse
  botao.addEventListener("pointerup", (ev) => {
    ev.stopPropagation();
    abrirHotspot(h);
  });
  camada.appendChild(botao);
  h.botao = botao;
});

/* -------------------------------------------------------------------------
   4. PROJEÇÃO 3D -> TELA (roda a cada quadro)
   ------------------------------------------------------------------------- */
const vetor = new THREE.Vector3();

function posicionarHotspots() {
  requestAnimationFrame(posicionarHotspots);
  if (!rastreando || !cena.camera || !cena.canvas) return;

  const camera = cena.camera;
  const area = cena.canvas.getBoundingClientRect(); // o canvas pode ser maior que a tela (cover)

  HOTSPOTS.forEach((h) => {
    h.ancora.object3D.getWorldPosition(vetor); // posição 3D atual da âncora
    vetor.project(camera);                      // -> coordenadas normalizadas (-1..1)

    const x = (vetor.x + 1) / 2 * area.width + area.left;
    const y = (1 - vetor.y) / 2 * area.height + area.top;
    const visivel = vetor.z < 1 && x > -40 && x < innerWidth + 40 && y > -40 && y < innerHeight + 40;

    h.botao.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    h.botao.classList.toggle("hotspot--oculto", !visivel);
  });
}
requestAnimationFrame(posicionarHotspots);

/* -------------------------------------------------------------------------
   5. EVENTOS DO MINDAR (tracking)
   ------------------------------------------------------------------------- */
cena.addEventListener("arReady", () => definirEstado("procurando", "PROCURANDO TARGET"));

cena.addEventListener("arError", () => {
  definirEstado("erro", "ERRO");
  mostrarAvisoGeral(
    "Não foi possível iniciar a câmera ou carregar o target (assets/targets/torno.mind). " +
    "Verifique a permissão da câmera e se a página está em HTTPS."
  );
});

alvo.addEventListener("targetFound", () => {
  rastreando = true;
  camada.classList.add("camada-hotspots--ativa");
  mira.classList.add("mira--oculta");
  definirEstado("ativo", "RA ATIVA");
  if (navigator.vibrate) navigator.vibrate(40);
  carregarIdentificacao();
});

alvo.addEventListener("targetLost", () => {
  rastreando = false;
  camada.classList.remove("camada-hotspots--ativa");
  mira.classList.remove("mira--oculta");
  definirEstado("procurando", "TARGET PERDIDO");
  // o painel continua aberto: o técnico pode ler sem apontar para a máquina
});

function definirEstado(tipo, texto) {
  estado.className = `estado estado--${tipo}`;
  estadoTexto.textContent = texto;
}

function mostrarAvisoGeral(msg) {
  avisoGeral.textContent = msg;
  avisoGeral.hidden = false;
}

/* -------------------------------------------------------------------------
   6. COMUNICAÇÃO COM A API FLASK (HTTP/JSON)
   ------------------------------------------------------------------------- */
async function buscarJSON(caminho) {
  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), TIMEOUT_MS); // não espera para sempre

  const cabecalhos = {};
  if (API_BASE.includes("ngrok")) cabecalhos["ngrok-skip-browser-warning"] = "1";

  try {
    const resposta = await fetch(API_BASE + caminho, {
      signal: controle.signal,
      cache: "no-store",
      headers: cabecalhos,
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    return await resposta.json();
  } finally {
    clearTimeout(limite);
  }
}

// Identificação do ativo no topo da tela (com dados locais de reserva)
let identificacaoCarregada = false;
async function carregarIdentificacao() {
  if (identificacaoCarregada) return;
  try {
    const dados = await buscarJSON(`/api/equipamentos/${ID_EQUIPAMENTO}`);
    document.getElementById("hud-id").textContent = dados.id;
    document.getElementById("hud-nome").textContent = dados.tipo;
    document.getElementById("hud-setor").textContent = `${dados.setor} · ${dados.status}`;
    identificacaoCarregada = true;
  } catch (erro) {
    document.getElementById("hud-setor").textContent = "Identificação local (API indisponível)";
  }
}

/* -------------------------------------------------------------------------
   7. PAINEL DE INFORMAÇÕES
   ------------------------------------------------------------------------- */
function abrirHotspot(h) {
  pararAtualizacao();
  hotspotAberto = h;
  ultimaTelemetria = null;

  HOTSPOTS.forEach((x) => x.botao.classList.toggle("hotspot--selecionado", x === h));
  painelNumero.textContent = h.numero;
  painelTitulo.textContent = h.titulo;
  painel.classList.add("painel--aberto");
  painel.setAttribute("aria-hidden", "false");

  if (h.tipo === "estatico") {
    painelConteudo.innerHTML = h.conteudo;
    painelFonte.textContent = "Fonte: conteúdo técnico do frontend";
    return;
  }

  painelFonte.textContent = `Fonte: API ${API_BASE}`;
  painelConteudo.innerHTML = `<div class="carregando"><span></span> Consultando a API...</div>`;
  consultarHotspotApi(h);

  if (h.atualizaSozinho) {
    temporizador = setInterval(() => consultarHotspotApi(h), INTERVALO_ATUALIZACAO_MS);
  }
}

function fecharPainel() {
  pararAtualizacao();
  hotspotAberto = null;
  painel.classList.remove("painel--aberto");
  painel.setAttribute("aria-hidden", "true");
  HOTSPOTS.forEach((x) => x.botao.classList.remove("hotspot--selecionado"));
}

function pararAtualizacao() {
  if (temporizador) clearInterval(temporizador);
  temporizador = null;
}

document.getElementById("painel-fechar").addEventListener("pointerup", fecharPainel);

async function consultarHotspotApi(h) {
  try {
    const dados = await buscarJSON(h.endpoint);
    if (hotspotAberto !== h) return; // usuário trocou de painel durante a consulta
    painelConteudo.innerHTML =
      h.id === "monitoramento" ? renderTelemetria(dados) : renderManutencao(dados);
  } catch (erro) {
    console.error("Falha ao consultar a API:", erro);
    if (hotspotAberto !== h) return;
    painelConteudo.innerHTML = renderIndisponivel();
    painelConteudo.querySelector(".botao-tentar")
      .addEventListener("pointerup", () => {
        painelConteudo.innerHTML = `<div class="carregando"><span></span> Tentando novamente...</div>`;
        consultarHotspotApi(h);
      });
  }
}

/* -------------------------------------------------------------------------
   8. RENDERIZAÇÃO DOS DADOS DINÂMICOS
   ------------------------------------------------------------------------- */
function esc(valor) {
  return String(valor ?? "—").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function renderTelemetria(d) {
  const mudou = (campo) =>
    ultimaTelemetria && ultimaTelemetria[campo] !== d[campo] ? " valor--mudou" : "";
  const html = `
    <div class="selo-didatico">DADOS SIMULADOS · USO DIDÁTICO</div>
    <div class="status status--${esc(d.status).replace(/\s/g, "-")}">
      <span class="status__led"></span> Status: <strong>${esc(d.status)}</strong>
    </div>
    <div class="metricas">
      <div class="metrica${mudou("temperatura")}">
        <span class="metrica__nome">Temperatura</span>
        <span class="metrica__valor">${esc(d.temperatura)}<small>°C</small></span>
      </div>
      <div class="metrica${mudou("vibracao")}">
        <span class="metrica__nome">Vibração</span>
        <span class="metrica__valor">${esc(d.vibracao)}<small>mm/s</small></span>
      </div>
      <div class="metrica${mudou("rpm")}">
        <span class="metrica__nome">Rotação</span>
        <span class="metrica__valor">${esc(d.rpm)}<small>rpm</small></span>
      </div>
    </div>
    <p class="atualizacao">Última atualização: <strong>${esc(d.atualizacao)}</strong>
      ${d.idade_segundos != null ? `(há ${Math.round(d.idade_segundos)} s)` : ""}</p>
    ${!d.mqtt_conectado
      ? `<p class="alerta">A API está sem conexão com o broker MQTT. Exibindo o último valor conhecido.</p>`
      : d.dado_antigo
      ? `<p class="alerta">Nenhum dado novo recebido recentemente. O valor pode estar desatualizado.</p>`
      : ""}
    <p class="nota">Atualiza sozinho a cada ${INTERVALO_ATUALIZACAO_MS / 1000} s enquanto este painel estiver aberto.</p>`;
  ultimaTelemetria = d;
  return html;
}

function renderManutencao(d) {
  const plano = (d.plano || []).map((p) => `<li>${esc(p)}</li>`).join("");
  const ordens = (d.ordens_abertas || [])
    .map((o) => `<li><strong>${esc(o.os)}</strong> — ${esc(o.descricao)} <em>(prioridade ${esc(o.prioridade)})</em></li>`)
    .join("") || "<li>Nenhuma ordem de serviço aberta</li>";
  return `
    <div class="selo-didatico">DADOS FICTÍCIOS · USO DIDÁTICO</div>
    <div class="datas">
      <div><span>Última preventiva</span><strong>${formatarData(d.ultima_preventiva)}</strong></div>
      <div><span>Próxima preventiva</span><strong>${formatarData(d.proxima_preventiva)}</strong></div>
    </div>
    <p>Responsável: <strong>${esc(d.responsavel)}</strong></p>
    <h3>Plano de manutenção</h3><ul>${plano}</ul>
    <h3>Ordens de serviço abertas</h3><ul>${ordens}</ul>`;
}

function renderIndisponivel() {
  return `
    <div class="indisponivel">
      <div class="indisponivel__icone">⚠</div>
      <p><strong>Não foi possível consultar os dados do equipamento.</strong><br>
      Verifique a disponibilidade do serviço e tente novamente.</p>
      <button class="botao-tentar">Tentar novamente</button>
      <p class="nota">As informações técnicas dos demais pontos continuam disponíveis.</p>
    </div>`;
}

function formatarData(iso) {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/* Log útil para a demonstração */
console.log(`[WebAR] Ativo ${ID_EQUIPAMENTO} | API: ${API_BASE}`);
