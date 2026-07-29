FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4173

COPY package.json ./
COPY index.html app.css ./
COPY src ./src
COPY scripts ./scripts
COPY schema ./schema
COPY docs ./docs
COPY examples ./examples

EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4173/api/v1/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "scripts/serve-api.mjs"]
