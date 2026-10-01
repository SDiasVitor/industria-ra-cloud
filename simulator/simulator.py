"""
Simulador de telemetria do Torno Convencional TC-01 (publisher MQTT)

Representa um gateway industrial que lê sensores da máquina e publica os dados
no broker. Publica periodicamente em:

    industria/TC-01/temperatura   (°C, simulado)
    industria/TC-01/vibracao      (mm/s, simulado)
    industria/TC-01/rpm           (rotação do eixo-árvore, simulado)
    industria/TC-01/status        (operando | parado | setup)

VALORES FICTÍCIOS E DIDÁTICOS — não são limites reais de nenhuma máquina.
"""

import os
import random
import time

import paho.mqtt.client as mqtt

MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
ID_ATIVO = os.getenv("ID_ATIVO", "TC-01")
INTERVALO_S = float(os.getenv("INTERVALO_S", "5"))
BASE = f"industria/{ID_ATIVO}"

# Rotações típicas de um seletor de engrenagens (valores ilustrativos)
RPMS_DISPONIVEIS = [180, 280, 450, 710, 1120]


def conectar():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"simulador-{ID_ATIVO}")
    while True:
        try:
            client.connect(MQTT_HOST, MQTT_PORT, keepalive=30)
            client.loop_start()
            print(f"[SIM] Conectado ao broker {MQTT_HOST}:{MQTT_PORT}", flush=True)
            return client
        except OSError as erro:
            print(f"[SIM] Broker indisponível ({erro}). Nova tentativa em 3 s...", flush=True)
            time.sleep(3)


def main():
    client = conectar()

    temperatura = 32.0
    status = "operando"
    rpm = 450

    while True:
        # Troca de estado ocasional (máquina para, faz setup, volta a operar)
        sorteio = random.random()
        if status == "operando" and sorteio < 0.08:
            status = random.choice(["parado", "setup"])
        elif status != "operando" and sorteio < 0.35:
            status = "operando"
            rpm = random.choice(RPMS_DISPONIVEIS)

        if status == "operando":
            # Esquenta aos poucos, com ruído; vibração cresce com a rotação
            temperatura += random.uniform(-0.4, 0.9)
            vibracao = 0.8 + rpm / 600 + random.uniform(-0.3, 0.4)
            rpm_atual = rpm
        else:
            # Parada: esfria e quase não vibra
            temperatura -= random.uniform(0.2, 0.8)
            vibracao = random.uniform(0.0, 0.2)
            rpm_atual = 0

        temperatura = max(24.0, min(temperatura, 58.0))  # faixa didática

        leituras = {
            "temperatura": f"{temperatura:.1f}",
            "vibracao": f"{max(vibracao, 0):.1f}",
            "rpm": str(rpm_atual),
            "status": status,
        }
        for grandeza, valor in leituras.items():
            # retain=True: quem assinar depois (ex.: API reiniciada) recebe o último valor
            client.publish(f"{BASE}/{grandeza}", valor, qos=1, retain=True)

        print(f"[SIM] {leituras}", flush=True)
        time.sleep(INTERVALO_S)


if __name__ == "__main__":
    main()
