# Stage 1: build the Vite app
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# base is baked in at build time (vite.config.js -> base: '/app/'), so the
# emitted asset URLs are /app/assets/*. The reverse proxy strips /app before
# this container sees the request, so nginx still serves them from root.
RUN npm run build

# Stage 2: static nginx runtime (SPA, no SSR, no backend proxy)
FROM nginx:alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
