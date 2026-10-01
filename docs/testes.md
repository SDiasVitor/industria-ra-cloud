# Matriz de Testes — Torno Convencional TC-01

**Data:** ____/____/2026  **Dispositivo:** ______________ **Navegador:** ______________
**URL WebAR:** ______________________ **URL API:** ______________________

| ID | Ação | Resultado esperado | Como verificar | Resultado obtido | OK? |
|----|------|--------------------|----------------|------------------|-----|
| T01 | Abrir a WebAR no celular | Navegador pede permissão; câmera aparece; estado "PROCURANDO TARGET" | Visual | | ☐ |
| T02 | Apontar para o target | Estado muda para **RA ATIVA** (LED verde), mira some, celular vibra | Visual | | ☐ |
| T03 | Movimentar celular/target | Os 6 hotspots acompanham as regiões do torno | Visual | | ☐ |
| T04 | Tocar hotspot técnico (1 a 4) | Painel com informação estática; rodapé "conteúdo técnico do frontend" | Visual | | ☐ |
| T05 | Tocar **Monitoramento** | API consultada; status + temperatura + vibração + rotação + horário | Rodapé mostra a URL da API; `docker compose logs api` mostra o GET | | ☐ |
| T06 | Publicar novo valor MQTT | API recebe o valor | `docker compose stop simulador` → `docker compose exec mqtt mosquitto_pub -h localhost -t industria/TC-01/temperatura -m 47.2 -r` → log da API: `[MQTT] industria/TC-01/temperatura = 47.2` | | ☐ |
| T07 | Consultar novamente | RA mostra **47.2 °C** (com destaque de alteração) | Painel aberto atualiza em até 5 s, ou fechar e tocar de novo | | ☐ |
| T08 | Parar a API | Mensagem "Não foi possível consultar os dados do equipamento..." + botão Tentar novamente; hotspots 1–4 continuam funcionando | `docker compose stop api` | | ☐ |
| T09 | Restaurar a API | Consulta volta a funcionar | `docker compose start api` → Tentar novamente | | ☐ |

## Testes complementares

| ID | Ação | Resultado esperado | Resultado obtido | OK? |
|----|------|--------------------|------------------|-----|
| T10 | Parar o broker (`docker compose stop mqtt`) e tocar Monitoramento | API responde com o último valor e aviso "sem conexão com o broker MQTT" | | ☐ |
| T11 | Religar o broker (`docker compose start mqtt`) | API reconecta sozinha (`mqtt_conectado: true`) | | ☐ |
| T12 | Tirar o target do enquadramento com painel aberto | Estado "TARGET PERDIDO", hotspots somem, painel continua legível | | ☐ |
| T13 | `docker compose down` e `docker compose up -d` | Todos os serviços sobem na ordem correta (mqtt → api/simulador) | | ☐ |
| T14 | GET `/api/equipamentos/XX-99` | HTTP 404 com mensagem de erro em JSON | | ☐ |

## Observações / problemas encontrados
-
