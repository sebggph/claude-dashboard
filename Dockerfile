# Claude Context Dashboard: no dependencies, just Node.
FROM node:22-alpine

WORKDIR /app
COPY package.json ./
COPY server ./server
COPY public ./public
COPY docs ./docs
COPY samples ./samples

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    CLAUDE_DIR=/data/claude

# Run as the unprivileged "node" user that ships with the image.
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server/index.js"]
