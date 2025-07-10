#!/bin/bash

cd packages/client-telegram
git pull origin wau/main

cd ../../

bun clean:demo && git restore bun.lock && bun install && bun run build

pm2 reload ecosystem.config.js
pm2 save