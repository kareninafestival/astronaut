FROM node:12

ENV YT_API_KEY YT_API_KEY

COPY package.json *.js public views file.csv /
RUN npm install

CMD ["node", "app.js"]
