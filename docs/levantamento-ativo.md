# Levantamento do Ativo e Planejamento dos Dados (Etapas 1 e 2)

> Preencher/confirmar os campos marcados com ✏️ após observar a máquina do laboratório.

## Etapa 1 — Levantamento do ativo

| Item | Registro |
|------|----------|
| Identificação | **TC-01** — Torno Convencional ✏️ (fabricante/modelo da plaqueta: ______) |
| Tipo | Torno mecânico horizontal (torno paralelo) |
| Função geral | Usinagem de peças de revolução: torneamento cilíndrico externo/interno, faceamento, sangramento, roscas, furação pelo contraponto |
| Setor / contexto | Usinagem — Laboratório/Oficina de Mecânica do SENAI São Carlos ✏️ |
| Target | Foto frontal do torno (ou etiqueta visual de alto contraste fixada na lateral do cabeçote) → `frontend/assets/targets/torno.jpg` → compilada em `torno.mind` |

### Regiões escolhidas para a RA

| # | Região | Por que foi escolhida | Tipo de conteúdo |
|---|--------|-----------------------|------------------|
| 1 | Cabeçote e placa | Onde ficam o eixo-árvore, a seleção de rotação e a fixação da peça | Componente + inspeção |
| 2 | Carro e porta-ferramenta | Conjunto que movimenta a ferramenta; ponto frequente de folga e desgaste | Componente + inspeção |
| 3 | Contraponto | Apoio de peças longas e furação; exige travamento e alinhamento | Componente + inspeção |
| 4 | Proteção e segurança | Placa girante é o principal risco do torno; reforça regras de operação | Segurança |
| 5 | Manutenção (barramento) | Plano de lubrificação e ordens de serviço mudam com o tempo | Dinâmico (API) |
| 6 | Monitoramento (caixa de engrenagens/motor) | Ponto onde temperatura e vibração fariam sentido em um sensor real | Dinâmico (API/MQTT) |

## Etapa 2 — Planejamento dos dados

| Dados que ficam no frontend | Dados que vêm do serviço (API) |
|-----------------------------|--------------------------------|
| Nome e descrição dos componentes | Identificação cadastrada (id, setor, status) |
| Função de cada região | Status operacional simulado |
| Pontos de inspeção | Temperatura simulada |
| Regras gerais de segurança | Vibração e rotação simuladas |
| Textos didáticos dos hotspots | Horário da última atualização |
| — | Plano de manutenção, datas e ordens de serviço |

### Justificativas das decisões

1. **Temperatura, vibração e status vêm da API.** São dados que mudam a cada poucos segundos e são produzidos *fora* do navegador (sensores → gateway → broker). Se ficassem no `app.js`, seriam valores congelados e mentirosos; a interface só deve exibir, não gerar, a medição.
2. **Informações de manutenção vêm da API.** Datas de preventiva e ordens de serviço são alteradas pela equipe de manutenção. Centralizando no serviço, uma atualização vale para todos os celulares sem republicar a WebAR.
3. **Descrição dos componentes e regras de segurança ficam no frontend.** São informações estáveis (a função do contraponto não muda). Mantê-las locais faz a RA continuar útil mesmo se a API cair — o técnico ainda consegue consultar orientações de segurança.
4. **Identificação do ativo:** vem da API (cadastro único), mas o frontend tem um texto de reserva para não deixar o topo da tela vazio em caso de falha.
