FROM node:20-alpine
WORKDIR /app

# Strapi 依赖 sharp 等原生模块编译工具
RUN apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev vips-dev git python3

ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

EXPOSE 1337
CMD ["npm", "run", "start"]
