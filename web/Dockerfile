# Servidor web da WebAR na rede local, com HTTPS
FROM nginx:alpine

# Gera um certificado autoassinado (válido por 1 ano) durante o build.
# A câmera do celular só funciona em páginas HTTPS.
RUN apk add --no-cache openssl \
 && mkdir -p /etc/nginx/certs \
 && openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
      -keyout /etc/nginx/certs/key.pem \
      -out /etc/nginx/certs/cert.pem \
      -subj "/C=BR/ST=SP/L=Sao Carlos/O=SENAI/CN=tc01-local"

# Substitui a configuração padrão do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 443