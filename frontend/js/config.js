/* =========================================================================
   Configuração da aplicação WebAR — Torno Convencional TC-01
   ========================================================================= */

window.CONFIG = {
  // Identificador do ativo na API
  ID_EQUIPAMENTO: "TC-01",

  // Endereço da API quando a página está no GitHub Pages e nenhum ?api= foi informado.
  API_PADRAO: "http://localhost:5000",

  // Tempo máximo de espera por uma resposta da API (ms)
  TIMEOUT_MS: 4000,

  // Atualização automática do painel de monitoramento enquanto aberto (ms)
  INTERVALO_ATUALIZACAO_MS: 5000,
};

/* Ordem de prioridade para descobrir o endereço da API:
     1) ?api=https://endereco-da-api  na URL da página (fica salvo no aparelho)
     2) endereço salvo anteriormente no aparelho
     3) página servida pelo Nginx local (https://IP-DO-PC:8443) -> mesma origem,
        pois o Nginx encaminha /api/... para a API Flask
     4) API_PADRAO (página no GitHub Pages sem ?api=)                         */
(function resolverApiBase() {
  const CHAVE = "tc01_api_base";
  const params = new URLSearchParams(window.location.search);
  let base = params.get("api");

  try {
    if (base) {
      localStorage.setItem(CHAVE, base);
    } else {
      base = localStorage.getItem(CHAVE);
    }
  } catch (e) {
    /* navegador sem localStorage: segue sem salvar */
  }

  if (!base) {
    const noGithubPages = window.location.hostname.endsWith("github.io");
    base = noGithubPages ? window.CONFIG.API_PADRAO : window.location.origin;
  }

  window.CONFIG.API_BASE = base.replace(/\/+$/, ""); // remove barra final
  window.CONFIG.DEBUG = params.get("debug") === "1";
})();