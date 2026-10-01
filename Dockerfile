# Run on the supported Node.js 22 runtime from the AWS ECR Public mirror.
FROM public.ecr.aws/docker/library/node:22-slim
WORKDIR /usr/src/app

# Copying only package.json files in order to install dependencies.
COPY package*.json ./

# Setting environment.
ARG NODE_ENV
ENV NODE_ENV $NODE_ENV

# Installing dependencies and PM2.
RUN npm cache clean --force \
    && npm install pm2 -g \
    && npm install ts-node@10.9.1 -g

# Copying the application's code.
COPY . .
RUN sed -e 's/\r$//' entrypoint.sh > /usr/bin/entrypoint.sh \
    && chmod +x /usr/bin/entrypoint.sh

# Expose ports.
EXPOSE 3030

ENTRYPOINT ["entrypoint.sh"]
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
