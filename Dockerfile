FROM mcr.microsoft.com/playwright:v1.54.0-noble

WORKDIR /workspaces/enterprise-playwright-framework

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV CI=true \
    ENVIRONMENT=dev \
    OUTPUT_DIR=output \
    WORKERS=1

CMD ["npm", "test"]