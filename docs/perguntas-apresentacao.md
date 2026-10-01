# Perguntas Técnicas da Apresentação — Respostas da Equipe

**1. Onde está executando o Flask?**
Dentro do container `tc01-api`, criado a partir do `backend/Dockerfile` (imagem `python:3.12-slim`). Ele é servido pelo **gunicorn** na porta 5000 do container, que o Compose publica na porta 5000 do computador (`ports: "5000:5000"`). Na demonstração, esse computador é o notebook da equipe; em produção seria uma VM (IaaS) ou uma plataforma (PaaS).

**2. Qual é a função do broker MQTT?**
É o intermediário das mensagens de telemetria. O simulador (que faz o papel do gateway da máquina) **publica** em tópicos como `industria/TC-01/temperatura`, e a API **assina** `industria/+/+`. Publisher e subscriber não se conhecem: o broker recebe e entrega. Isso desacopla quem produz o dado de quem consome — dá para adicionar um dashboard ou um banco histórico assinando os mesmos tópicos sem mexer no simulador.

**3. Por que a WebAR consulta a API por HTTP/JSON?**
Porque é o protocolo nativo do navegador (`fetch()`), passa por HTTPS e firewalls sem configuração especial, e o modelo **requisição/resposta** combina com a interação: o técnico toca e quer a resposta naquele momento. A API também funciona como camada de controle: o celular não precisa saber nada de MQTT, tópicos ou broker, e o broker não fica exposto à internet.

**4. Qual serviço está em cada container?**
`tc01-mqtt` → Eclipse Mosquitto (broker); `tc01-api` → API Flask + subscriber MQTT; `tc01-simulador` → publisher Python de dados fictícios; `tc01-tunel` (opcional) → cloudflared, que dá HTTPS para a API. A WebAR **não** está em container: é estática no GitHub Pages.

**5. O que acontece se o broker MQTT ficar indisponível?**
A API **continua respondendo** com o último valor que tem em memória, informando `mqtt_conectado: false`; a WebAR mostra um aviso de que os dados podem estar desatualizados. O cliente paho-mqtt tenta reconectar sozinho (1 a 10 s) e, quando o broker volta, a telemetria se atualiza. O simulador também fica tentando reconectar. Os tópicos são publicados com *retain*, então ao reconectar a API recebe imediatamente o último valor guardado pelo broker.

**6. Onde está armazenado o último dado simulado?**
Em **dois lugares**: (a) na **memória do processo da API** (dicionário `telemetria` no `app.py`, protegido por um *lock* porque o MQTT roda em outra thread) — é dali que o endpoint lê; (b) no **broker**, como mensagem *retida* de cada tópico, persistida no volume `mqtt-dados`. Se a API reiniciar, ela perde a memória, mas recebe de novo os valores retidos ao assinar.

**7. Como os hotspots acompanham o target?**
Cada hotspot tem uma **âncora** (`a-entity`) filha do `mindar-image-target`. O MindAR estima a pose do target a cada quadro da câmera e atualiza a matriz dessa entidade; as âncoras herdam a transformação. No `app.js`, a cada quadro (`requestAnimationFrame`) pegamos a posição 3D da âncora (`getWorldPosition`), projetamos para a tela com a câmera (`vector.project(camera)`) e convertemos as coordenadas normalizadas (-1 a 1) em pixels para mover o botão HTML com `transform`. Os eventos `targetFound`/`targetLost` mostram e escondem os hotspots.

**8. Qual a diferença entre o target físico e o arquivo `.mind`?**
O **target físico** é a imagem real (foto/etiqueta na máquina) que a câmera enxerga. O **`.mind`** é o resultado da compilação dessa imagem: um arquivo com os **pontos característicos** (features) extraídos dela em várias escalas. O MindAR compara os pontos encontrados na câmera com os do `.mind` para reconhecer e calcular a posição. Sem o `.mind` não há reconhecimento; se a imagem física for diferente da compilada, também não.

**9. Qual componente deveria ser escalado se muitos usuários consultassem a API?**
A **API Flask** — é ela que recebe as requisições HTTP de todos os celulares. A WebAR é estática (o GitHub Pages/CDN já escala) e o broker recebe só o tráfego do simulador. Detalhe importante: hoje o estado está em memória com **1 worker** de propósito; para ter várias réplicas, o último dado teria que ir para um armazenamento compartilhado (Redis/banco) e as réplicas ficariam atrás de um balanceador de carga.

**10. Em qual cenário da atividade IaaS é mais adequado? Justifique.**
No cenário da **VM Linux com Docker, Flask e MQTT**. Precisamos manter um broker MQTT rodando continuamente em porta TCP (1883), algo que PaaS de aplicações web geralmente não oferece; e com a VM o `compose.yaml` testado no laboratório roda sem mudanças. O preço é a equipe cuidar de SO, atualizações, firewall e backup.

**11. O que mudaria em uma implantação PaaS?**
Enviaríamos o código/imagem da API e a plataforma cuidaria de SO, runtime, HTTPS, escala e reinício. Mudanças: URL HTTPS fixa (sem túnel); broker MQTT passaria a ser um serviço gerenciado externo (HiveMQ Cloud, EMQX Cloud, AWS IoT Core), configurado por variável de ambiente; o estado em memória iria para Redis/banco, porque o PaaS pode criar ou reiniciar instâncias a qualquer momento; perderíamos controle fino do servidor.

**12. Quais partes do sistema continuariam funcionando se a API parasse?**
Toda a parte de **Realidade Aumentada**: câmera, reconhecimento do target, tracking, os 4 hotspots estáticos (Cabeçote, Carro, Contraponto, Segurança) e a identificação local no topo. Também continuariam o **broker** e o **simulador** trocando mensagens. Só os hotspots **Manutenção** e **Monitoramento** mostram a mensagem de indisponibilidade, com botão para tentar de novo.

---

### Pergunta da Etapa 7 — Qual problema o container resolve neste projeto?
Vai além de "executar o Flask":
- **Ambiente idêntico em qualquer máquina**: mesma versão de Python, Flask, paho-mqtt e Mosquitto no notebook de cada integrante, no laboratório e na nuvem — acaba o "na minha máquina funciona";
- **Isolamento**: API, broker e simulador não disputam dependências nem portas internas, e cada um pode ser parado/reiniciado separadamente (é assim que simulamos a falha da API sem derrubar o resto);
- **Infraestrutura como código**: `Dockerfile` e `compose.yaml` documentam exatamente como o sistema é montado, versionados no Git;
- **Portabilidade para a nuvem**: a mesma imagem roda em VM (IaaS) ou em plataformas que aceitam containers (PaaS), sem reinstalação manual;
- **Orquestração**: o Compose sobe tudo com um comando, na ordem certa (`depends_on` + healthcheck), e reinicia serviços que caírem (`restart: unless-stopped`).
