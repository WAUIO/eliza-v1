#!/bin/bash

cd packages/plugin-telegram
git pull origin wau/main

cd ../../

bun clean:demo && git restore bun.lock && bun install && bun run build

pm2 reload ecosystem.config.cjs
pm2 save