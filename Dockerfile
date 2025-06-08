# Use an appropriate Node.js base image
FROM node:16-alpine

# Set the working directory
WORKDIR /usr/src/app

# Install FFmpeg
RUN apk add --no-cache ffmpeg

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Define mount points for persistent data
VOLUME /usr/src/app/db
VOLUME /usr/src/app/public/uploads/videos
VOLUME /usr/src/app/public/uploads/thumbnails
VOLUME /usr/src/app/public/uploads/avatars
VOLUME /usr/src/app/logs

# Expose the application port
EXPOSE 7575

# Define the command to run the application
CMD [ "npm", "start" ]
