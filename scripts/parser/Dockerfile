FROM node:16
ENV NODE_ENV production
# Add a work directory
WORKDIR /script
# Cache and Install dependencies
COPY package.json .
COPY yarn.lock .
RUN yarn install --production
# Copy app files
COPY . .