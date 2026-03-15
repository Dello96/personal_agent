FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache ca-certificates && update-ca-certificates

ENV NODE_ENV=production
ARG DATABASE_URL="postgresql://postgres:postgres@localhost:5432/service_project"
ENV DATABASE_URL=${DATABASE_URL}

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn prisma generate

EXPOSE 8080

CMD ["node", "server.js"]
