FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=Asia/Shanghai
COPY package.json ./
COPY server.js db.js util.js schema.js events.js ingest.js calendar-v2.js public-api.js admin-api.js http.js ./
COPY collectors ./collectors
COPY public ./public
RUN mkdir -p /data
EXPOSE 8789
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8789/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
