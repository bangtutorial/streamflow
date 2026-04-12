FROM node:20-bookworm

RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev \
    && npm rebuild sqlite3 --build-from-source

COPY . .

RUN mkdir -p db logs public/uploads/videos public/uploads/thumbnails

EXPOSE 7575

CMD ["npm", "start"]