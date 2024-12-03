#!/bin/bash

set -e

# Check if the clean parameter is passed
if [ "$1" = "clean" ]; then
  echo "Cleaning the database..."
  npx prisma migrate reset --force --skip-generate --skip-seed
fi

echo "Installing dependencies..."
if ! npm install; then
    echo "Failed to install dependencies."
    exit 1
fi

echo "Cleaning previous build..."
rm -rf dist
rm -rf node_modules/.prisma

echo "Creating new migrations (if needed)..."
if ! npx prisma migrate dev --name init; then
    echo "Failed to create new migrations."
    exit 1
fi

echo "Running database migrations..."
if ! npx prisma migrate deploy; then
    echo "Failed to run database migrations."
    exit 1
fi

echo "Generating Prisma client..."
if ! npx prisma generate; then
    echo "Failed to generate Prisma client."
    exit 1
fi

echo "Building the project..."
if ! npx tsc; then
    echo "Failed to build the project."
    exit 1
fi

echo "Creating necessary directories..."
mkdir -p dist/public/css
mkdir -p dist/views/layouts
mkdir -p dist/views/partials
mkdir -p dist/views/pages

echo "Copying static files, views, and env..."
cp -r src/public/* dist/public/
cp -r src/views/* dist/views/
cp .env dist/
cp prisma/schema.prisma dist/

echo "Creating logs directory..."
mkdir -p logs

echo "Build completed successfully."