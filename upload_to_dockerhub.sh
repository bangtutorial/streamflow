#!/bin/bash

# Prompt for Docker Hub username and image name
read -p "Enter your Docker Hub username: " DOCKERHUB_USERNAME
read -p "Enter the Docker image name (e.g., streamflow): " IMAGE_NAME

# Read version from package.json
APP_VERSION=$(node -p "require('./package.json').version")

# Construct the full image tag
FULL_IMAGE_NAME="$DOCKERHUB_USERNAME/$IMAGE_NAME:$APP_VERSION"
LATEST_IMAGE_NAME="$DOCKERHUB_USERNAME/$IMAGE_NAME:latest"

# Build the Docker image
echo "Building Docker image: $FULL_IMAGE_NAME and $LATEST_IMAGE_NAME..."
docker build -t "$FULL_IMAGE_NAME" -t "$LATEST_IMAGE_NAME" .

# Check if the build was successful
if [ $? -ne 0 ]; then
  echo "Docker build failed. Exiting."
  exit 1
fi

echo "Image built successfully."

# Ask the user if they want to push to Docker Hub
read -p "Do you want to push the image to Docker Hub? (y/n): " PUSH_TO_HUB

if [[ "$PUSH_TO_HUB" == "y" || "$PUSH_TO_HUB" == "Y" ]]; then
  # Log in to Docker Hub (optional, if credentials are not already configured)
  echo "Please log in to Docker Hub if you haven't already."
  docker login

  # Check if login was successful
  if [ $? -ne 0 ]; then
    echo "Docker login failed. Exiting."
    exit 1
  fi

  # Push the Docker image
  echo "Pushing image $FULL_IMAGE_NAME to Docker Hub..."
  docker push "$FULL_IMAGE_NAME"
  if [ $? -ne 0 ]; then
    echo "Failed to push $FULL_IMAGE_NAME. Exiting."
    exit 1
  fi

  echo "Pushing image $LATEST_IMAGE_NAME to Docker Hub..."
  docker push "$LATEST_IMAGE_NAME"
  if [ $? -ne 0 ]; then
    echo "Failed to push $LATEST_IMAGE_NAME. Exiting."
    exit 1
  fi

  echo "Image pushed successfully to Docker Hub: $FULL_IMAGE_NAME and $LATEST_IMAGE_NAME"
else
  echo "Image not pushed to Docker Hub."
fi

echo "Script finished."
