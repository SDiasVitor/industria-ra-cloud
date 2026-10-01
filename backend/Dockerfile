# Imagem base enxuta com Python 3.12
FROM python:3.12-slim

# Evita arquivos .pyc e garante logs imediatos no "docker compose logs"
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=America/Sao_Paulo

WORKDIR /app

# Instala dependências primeiro (aproveita o cache de camadas do Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia o código da API
COPY app.py .

EXPOSE 5000

# 1 worker de propósito: o último dado MQTT fica em memória neste processo.
# Com vários workers, cada um teria sua própria cópia do estado.
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--threads", "4", "app:app"]
