# Минимальный образ Nginx
FROM nginx:alpine

# Удалим дефолтный конфиг и положим свой
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Статические файлы
COPY index.html /usr/share/nginx/html/index.html
# Если будут ассеты — раскомментируй:
# COPY assets/ /usr/share/nginx/html/assets/

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ || exit 1
