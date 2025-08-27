#!/bin/bash

npm i
cp .env.example .env
npm run generate-secret
node db/database.js