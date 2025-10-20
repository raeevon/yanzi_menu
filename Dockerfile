FROM nginx:alpine

# Поставим curl для healthcheck (можно удалить блок HEALTHCHECK, если не нужен)
RUN apk add --no-cache curl

# Кладём конфиг как ШАБЛОН — entrypoint заменит ${PORT} на значение из окружения Railway
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Статика
COPY index.html /usr/share/nginx/html/index.html
# COPY assets/ /usr/share/nginx/html/assets/

# Healthcheck: шлём запрос на локальный ${PORT}
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD curl -fsS http://127.0.0.1:${PORT}/ || exit 1
