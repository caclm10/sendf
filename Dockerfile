# Definisi versi Node secara global agar seragam di semua stage
ARG NODE_VERSION=20-alpine

# =========================================================================
# Stage 1: Build the application
# =========================================================================
FROM node:${NODE_VERSION} AS builder

ARG WORK_DIR=/app
WORKDIR ${WORK_DIR}

# Salin berkas dependency
COPY package*.json ./

# Instal semua dependency untuk build
RUN npm ci

# Salin source code
COPY . .

# Lakukan build
RUN npm run build


# =========================================================================
# Stage 2: Production runner
# =========================================================================
FROM node:${NODE_VERSION} AS runner

ARG WORK_DIR=/app
WORKDIR ${WORK_DIR}

# Definisikan Port dan Environment secara runtime
ENV PORT=5000
ENV NODE_ENV=production

# Buat folder uploads dan atur izin akses untuk user 'node'
RUN mkdir -p ${WORK_DIR}/uploads && chown -R node:node ${WORK_DIR}

# Salin hasil kompilasi dari stage builder menggunakan variabel direktori kerja
COPY --chown=node:node --from=builder ${WORK_DIR}/dist ./dist
COPY --chown=node:node --from=builder ${WORK_DIR}/package.json ./package.json

# Docker otomatis mengekspos port sesuai variabel ENV PORT
EXPOSE ${PORT}

# Gunakan non-root user untuk alasan keamanan
USER node

# Jalankan aplikasi
CMD ["node", "dist/server.cjs"]
