FROM node:argon

# Install mcrypt
RUN apt-get update && apt-get install -y libmcrypt-dev

ADD app/package.json /tmp/package.json
RUN cd /tmp && npm install
RUN mkdir -p /usr/src/app && cp -a /tmp/node_modules /usr/src/

WORKDIR /usr/src/app
ADD ./app /usr/src/app