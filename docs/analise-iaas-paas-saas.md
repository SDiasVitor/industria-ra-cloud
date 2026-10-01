# Análise dos Modelos de Serviço — IaaS, PaaS e SaaS (Etapa 9)

A classificação depende de **quem cuida de cada camada**. Quanto mais camadas o provedor assume, menos controle — e menos trabalho operacional — fica com quem consome o serviço.

| Camada | On-premise | IaaS | PaaS | SaaS |
|--------|:---------:|:----:|:----:|:----:|
| Aplicação (código da API, WebAR) | Empresa | Empresa | Empresa | Provedor |
| Dados (cadastro, telemetria) | Empresa | Empresa | Empresa | Provedor* |
| Runtime (Python, Flask, gunicorn) | Empresa | Empresa | Provedor | Provedor |
| Middleware (Docker, Mosquitto) | Empresa | Empresa | Provedor / serviço gerenciado | Provedor |
| Sistema operacional (Linux) | Empresa | Empresa | Provedor | Provedor |
| Virtualização, servidores, rede, datacenter | Empresa | Provedor | Provedor | Provedor |

\* No SaaS os dados continuam sendo **do cliente**, mas armazenamento, backup e disponibilidade são responsabilidade do provedor.

---

## Cenário 1 — A empresa contrata uma VM Linux e instala Docker, Flask e MQTT

**Modelo: IaaS (Infraestrutura como Serviço).**

O provedor (AWS EC2, Azure VM, Google Compute Engine, Oracle Cloud etc.) entrega **hardware virtualizado**: CPU, memória, disco, rede e o hipervisor. A partir do sistema operacional, tudo é da empresa.

**Continuam com a empresa:**
- Instalar, atualizar e aplicar patches de segurança no Linux;
- Instalar e manter Docker, Docker Compose, Mosquitto e a API;
- Configurar firewall (portas 5000, 1883), certificado HTTPS e acesso SSH;
- Monitorar se os containers caíram, reiniciar serviços, fazer backup;
- Dimensionar a VM (se faltar memória, é ela quem troca o tamanho).

**Por que combina com o nosso projeto:** o `compose.yaml` roda exatamente igual na VM e no notebook da equipe. É o cenário com **mais controle** e o mais adequado quando precisamos de serviços que não são HTTP comum — como o **broker MQTT na porta 1883**, que exige TCP aberto e processo rodando o tempo todo.

## Cenário 2 — A equipe envia a aplicação para uma plataforma que administra infraestrutura e ambiente de execução

**Modelo: PaaS (Plataforma como Serviço).** Ex.: Render, Railway, Heroku, Google Cloud Run, Azure App Service, AWS Elastic Beanstalk.

A equipe entrega o **código** (ou a imagem gerada pelo `Dockerfile`) e a plataforma cuida do resto.

**Deixa de ser responsabilidade da equipe:**
- Sistema operacional, patches e atualização do runtime;
- Servidor web/porta pública e, em geral, o **certificado HTTPS** (resolveria o problema de conteúdo misto sem precisar do túnel);
- Escalonamento (mais instâncias quando aumenta o acesso), balanceamento e reinício automático;
- Logs e métricas centralizados.

**Continua com a equipe:** o código da API, as variáveis de ambiente (`MQTT_HOST`), as dependências (`requirements.txt`) e a lógica dos dados.

**O que mudaria no projeto:**
- A API ganharia URL HTTPS fixa (ex.: `https://tc01-api.onrender.com`);
- O broker MQTT normalmente **não** roda na mesma plataforma web — usaríamos um **broker gerenciado** (HiveMQ Cloud, EMQX Cloud, AWS IoT Core) ou manteríamos o Mosquitto em uma VM;
- Como o PaaS pode criar várias instâncias e reiniciá-las, o "último dado" guardado **em memória** precisaria ir para um armazenamento compartilhado (Redis ou banco), senão cada instância teria um valor diferente.

## Cenário 3 — O técnico apenas acessa uma aplicação pronta pelo navegador

**Modelo: SaaS (Software como Serviço), sob a perspectiva do usuário.**

O técnico não instala nada, não sabe onde está o Flask, não mantém servidor: ele abre um link no celular e usa. **Toda** a pilha (infraestrutura, plataforma, aplicação e dados) é responsabilidade de quem oferece o serviço. Ao técnico cabe apenas usar corretamente e ter um dispositivo com navegador e câmera.

**Relação com o nosso projeto:** para o técnico, a WebAR **é** um SaaS — acesso por navegador, sempre na versão mais recente (publicamos uma vez no GitHub Pages e todos recebem), sem instalação. Do ponto de vista da **equipe de TI**, porém, o mesmo sistema é construído sobre IaaS ou PaaS. Ou seja, o modelo depende de **quem olha**: o que é SaaS para o usuário final é IaaS/PaaS para quem o mantém. Exemplos de SaaS completos no mercado industrial seriam plataformas de manutenção como as de CMMS (gestão de manutenção) oferecidas por assinatura.

---

## Qual cenário é mais adequado para este protótipo?

**IaaS (VM com Docker Compose)**, porque:
1. Reaproveita o `compose.yaml` sem alterações — o que foi testado no laboratório é o que vai para a nuvem;
2. Hospeda **os três serviços juntos**, inclusive o broker MQTT (TCP/1883), que plataformas PaaS de aplicação web não costumam expor;
3. O estado da telemetria em memória funciona bem com uma única instância.

O **PaaS** seria a evolução natural se o número de usuários crescesse: a API iria para uma plataforma com escalonamento automático, o MQTT para um broker gerenciado e o estado para um Redis.

## Onde o projeto já usa "nuvem" hoje
| Componente | Onde roda | Modelo aproximado |
|------------|-----------|-------------------|
| WebAR | GitHub Pages | PaaS de site estático (só enviamos os arquivos) |
| API, broker, simulador | Containers Docker (notebook / VM) | IaaS quando em uma VM |
| Túnel HTTPS | Cloudflare | Serviço gerenciado de rede |
| Aplicação vista pelo técnico | Navegador | SaaS (perspectiva do usuário) |
