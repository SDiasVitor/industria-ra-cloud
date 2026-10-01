"""
API Flask — Sistema de Apoio à Manutenção Industrial (Torno Convencional TC-01)

Responsabilidades deste serviço:
  1. Assinar (subscribe) os tópicos MQTT de telemetria publicados pelo simulador.
  2. Guardar em memória o ÚLTIMO valor recebido de cada grandeza.
  3. Entregar esses dados à aplicação WebAR por HTTP/JSON.

ATENÇÃO: todos os valores (temperatura, vibração, rotação, status, manutenção)
são SIMULADOS para fins didáticos. Não representam limites reais de segurança
nem parâmetros oficiais de nenhum torno.
"""

import os
import threading
import time
from datetime import datetime
from zoneinfo import ZoneInfo

import paho.mqtt.client as mqtt
from flask import Flask, jsonify
from flask_cors import CORS

# ---------------------------------------------------------------------------
# Configuração (vem de variáveis de ambiente definidas no compose.yaml)
# ---------------------------------------------------------------------------
MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_TOPICO_BASE = os.getenv("MQTT_TOPICO_BASE", "industria")
FUSO = ZoneInfo(os.getenv("TZ", "America/Sao_Paulo"))

# Depois de quantos segundos sem receber dado a telemetria é considerada "antiga"
LIMITE_DADO_ANTIGO_S = int(os.getenv("LIMITE_DADO_ANTIGO_S", "30"))

app = Flask(__name__)
# CORS liberado: a WebAR fica em outro domínio (ex.: GitHub Pages) e precisa
# poder chamar esta API pelo navegador.
CORS(app)
app.json.ensure_ascii = False  # acentos legíveis no JSON

# ---------------------------------------------------------------------------
# Dados ESTÁTICOS do ativo (cadastro) — pertencem ao serviço, não à interface
# ---------------------------------------------------------------------------
EQUIPAMENTOS = {
    "TC-01": {
        "id": "TC-01",
        "tipo": "Torno Convencional",
        "descricao": "Torno mecânico horizontal para usinagem de peças cilíndricas",
        "setor": "Usinagem / Oficina de Mecânica",
        "localizacao": "Laboratório de Usinagem — SENAI São Carlos",
        "status": "operacional",
        "dados_didaticos": True,
    }
}

# Informações de manutenção definidas para o protótipo (fictícias)
MANUTENCAO = {
    "TC-01": {
        "ultima_preventiva": "2026-08-15",
        "proxima_preventiva": "2026-11-15",
        "responsavel": "Equipe de Manutenção — Turno A",
        "plano": [
            "Verificar nível de óleo do cabeçote e da caixa Norton",
            "Lubrificar barramento, fuso e vara",
            "Inspecionar folga do carro transversal e do carro superior",
            "Verificar tensão e estado das correias",
            "Testar botão de emergência e proteção da placa",
        ],
        "ordens_abertas": [
            {"os": "OS-2026-0412", "descricao": "Ajuste de folga no carro transversal", "prioridade": "média"}
        ],
        "dados_didaticos": True,
    }
}

# ---------------------------------------------------------------------------
# Estado da TELEMETRIA — último valor recebido por MQTT (fica em memória)
# ---------------------------------------------------------------------------
telemetria = {
    "TC-01": {
        "temperatura": None,  # °C (simulado)
        "vibracao": None,     # mm/s (simulado)
        "rpm": None,          # rotação do eixo-árvore (simulado)
        "status": "sem dados",
        "atualizacao": None,  # hora "HH:MM:SS" do último dado recebido
        "_timestamp": None,   # epoch, usado para calcular a idade do dado
    }
}
trava = threading.Lock()  # o callback MQTT roda em outra thread
mqtt_conectado = False


def agora():
    return datetime.now(FUSO)


# ---------------------------------------------------------------------------
# Cliente MQTT (subscriber)
# ---------------------------------------------------------------------------
def ao_conectar(client, userdata, flags, reason_code, properties):
    global mqtt_conectado
    if reason_code == 0:
        mqtt_conectado = True
        # industria/+/+  ->  industria/<ID_DO_ATIVO>/<GRANDEZA>
        client.subscribe(f"{MQTT_TOPICO_BASE}/+/+")
        print(f"[MQTT] Conectado a {MQTT_HOST}:{MQTT_PORT} — assinando {MQTT_TOPICO_BASE}/+/+", flush=True)
    else:
        print(f"[MQTT] Falha ao conectar: {reason_code}", flush=True)


def ao_desconectar(client, userdata, flags, reason_code, properties):
    global mqtt_conectado
    mqtt_conectado = False
    print(f"[MQTT] Desconectado ({reason_code}). Tentando reconectar...", flush=True)


def ao_receber(client, userdata, msg):
    """Executado a cada mensagem MQTT. Ex.: industria/TC-01/temperatura -> 47.2"""
    partes = msg.topic.split("/")
    if len(partes) != 3:
        return
    _, id_ativo, grandeza = partes
    valor_txt = msg.payload.decode("utf-8", errors="ignore").strip()

    with trava:
        if id_ativo not in telemetria:
            return  # ignora ativos não cadastrados
        dados = telemetria[id_ativo]

        if grandeza in ("temperatura", "vibracao"):
            try:
                dados[grandeza] = round(float(valor_txt), 1)
            except ValueError:
                print(f"[MQTT] Valor inválido em {msg.topic}: {valor_txt!r}", flush=True)
                return
        elif grandeza == "rpm":
            try:
                dados["rpm"] = int(float(valor_txt))
            except ValueError:
                return
        elif grandeza == "status":
            dados["status"] = valor_txt
        else:
            return  # grandeza desconhecida

        momento = agora()
        dados["atualizacao"] = momento.strftime("%H:%M:%S")
        dados["_timestamp"] = momento.timestamp()

    print(f"[MQTT] {msg.topic} = {valor_txt}", flush=True)


def iniciar_mqtt():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="api-flask-tc01")
    client.on_connect = ao_conectar
    client.on_disconnect = ao_desconectar
    client.on_message = ao_receber
    client.reconnect_delay_set(min_delay=1, max_delay=10)
    # connect_async + loop_start: a API sobe mesmo que o broker ainda não esteja
    # pronto; a biblioteca fica tentando reconectar em segundo plano.
    client.connect_async(MQTT_HOST, MQTT_PORT, keepalive=30)
    client.loop_start()
    return client


# ---------------------------------------------------------------------------
# Endpoints HTTP
# ---------------------------------------------------------------------------
def nao_encontrado(id_equipamento):
    return jsonify({"erro": f"Equipamento '{id_equipamento}' não encontrado"}), 404


@app.get("/")
def raiz():
    return jsonify({
        "servico": "API de Apoio à Manutenção — Torno Convencional",
        "endpoints": [
            "/api/saude",
            "/api/equipamentos/TC-01",
            "/api/equipamentos/TC-01/telemetria",
            "/api/equipamentos/TC-01/manutencao",
        ],
    })


@app.get("/api/saude")
def saude():
    """Usado pelo healthcheck do Docker e para diagnóstico."""
    return jsonify({"api": "ok", "mqtt_conectado": mqtt_conectado, "hora": agora().strftime("%H:%M:%S")})


@app.get("/api/equipamentos/<id_equipamento>")
def equipamento(id_equipamento):
    id_equipamento = id_equipamento.upper()
    if id_equipamento not in EQUIPAMENTOS:
        return nao_encontrado(id_equipamento)
    return jsonify(EQUIPAMENTOS[id_equipamento])


@app.get("/api/equipamentos/<id_equipamento>/telemetria")
def obter_telemetria(id_equipamento):
    id_equipamento = id_equipamento.upper()
    if id_equipamento not in telemetria:
        return nao_encontrado(id_equipamento)

    with trava:
        dados = dict(telemetria[id_equipamento])

    ts = dados.pop("_timestamp")
    idade = round(time.time() - ts, 1) if ts else None
    dados["idade_segundos"] = idade
    dados["dado_antigo"] = idade is None or idade > LIMITE_DADO_ANTIGO_S
    dados["mqtt_conectado"] = mqtt_conectado
    dados["unidades"] = {"temperatura": "°C", "vibracao": "mm/s", "rpm": "rpm"}
    dados["dados_didaticos"] = True
    return jsonify(dados)


@app.get("/api/equipamentos/<id_equipamento>/manutencao")
def manutencao(id_equipamento):
    id_equipamento = id_equipamento.upper()
    if id_equipamento not in MANUTENCAO:
        return nao_encontrado(id_equipamento)
    return jsonify(MANUTENCAO[id_equipamento])


# Inicia o subscriber MQTT quando o módulo é carregado (1 worker no gunicorn).
cliente_mqtt = iniciar_mqtt()

if __name__ == "__main__":
    # Execução local sem Docker: python app.py
    app.run(host="0.0.0.0", port=5000, debug=False)
