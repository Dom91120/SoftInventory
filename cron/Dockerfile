# Conteneur cron : busybox crond + curl — appelle les routes /api/cron/* de
# l'app toutes les 5 minutes (la planification réelle est configurée dans
# l'admin, onglet Tâches planifiées).
FROM alpine:3.22
RUN apk add --no-cache curl tzdata
ENV TZ=Europe/Paris
COPY crontab /etc/crontabs/root
# -f : foreground (pour Docker) ; -l 2 : niveau de log
CMD ["crond", "-f", "-l", "2"]
