/* =========================================================================
   Configuração da aplicação WebAR — Torno Convencional TC-01
   ========================================================================= */

window.CONFIG = {
  // Identificador do ativo na API
  ID_EQUIPAMENTO: "TC-01",

  // Endereço da API quando nenhum outro for informado.
  // Ordem de prioridade (ver resolverApiBase abaixo):
  //   1) ?api=https://endereco-da-api  na URL da página (fica salvo no aparelho)
  //   2) endereço salvo anteriormente no aparelho
  //   3) mesmo host da página, porta 5000 (teste local na rede)
  //   4) API_PADRAO
  API_PADRAO: "http://localhost:5000",

  // Tempo máximo de espera por uma resposta da API (ms)
  TIMEOUT_MS: 4000,

  // Atualização automática do painel de monitoramento enquanto aberto (ms)
  INTERVALO_ATUALIZACAO_MS: 5000,
};

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
    const host = window.location.hostname;
    const ehRedeLocal =
      host === "localhost" || host === "127.0.0.1" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    base = ehRedeLocal ? `http://${host}:5000` : window.CONFIG.API_PADRAO;
  }

  window.CONFIG.API_BASE = base.replace(/\/+$/, ""); // remove barra final
  window.CONFIG.DEBUG = params.get("debug") === "1";
})();
