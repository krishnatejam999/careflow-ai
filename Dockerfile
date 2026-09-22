# CareFlow AI — production image.
# Zero runtime dependencies, so the image is tiny and the build needs no install step.
FROM node:20-alpine

ENV NODE_ENV=production \
    PORT=4000 \
    HOST=0.0.0.0 \
    DATA_DIR=/data

WORKDIR /app

# App source (no dependencies to install — the server is pure Node stdlib).
COPY package.json ./
COPY server.js ./
COPY lib ./lib
COPY public ./public
COPY scripts ./scripts

# Writable location for the JSON data layer, so a mounted volume can persist it.
RUN mkdir -p /data && chown -R node:node /app /data

USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=4s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
