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

# Expose the application port
EXPOSE 7575

# Define the command to run the application
CMD [ "npm", "start" ]
