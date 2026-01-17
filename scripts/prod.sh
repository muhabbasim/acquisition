#!/bin/bash

# Development startup script for Acquisition App with Neon Local
# This script starts the application in development mode with Neon Local

echo "🚀 Starting Acquisition App in Development Mode"
echo "================================================"

# Check if .env.development exists
if [ ! -f .env.development ]; then
    echo "❌ Error: .env.development file not found!"
    exit 1
fi

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Error: Docker is not running!"
    exit 1
fi

# Create .neon_local directory if it doesn't exist
mkdir -p .neon_local

# Add .neon_local to .gitignore if not already present
if ! grep -q ".neon_local/" .gitignore 2>/dev/null; then
    echo ".neon_local/" >> .gitignore
    echo "✅ Added .neon_local/ to .gitignore"
fi

echo "📦 Building and starting development containers..."
echo ""

# Run migrations with Drizzle
echo "📜 Applying latest schema with Drizzle..."
npm run db:migrate

# Wait for the database to be ready
echo "⏳ Waiting for the database to be ready..."
docker compose exec neon-local psql -U neon -d neondb -c 'SELECT 1'

# Start development environment
docker compose -f docker-compose.dev.yml up --build

echo ""
echo "🎉 Production environment started!"
echo "   Application: http://localhost:3000"
echo "   Logs: docker logs acquisition-app-prod"
echo ""
echo "Useful commands:"
echo "   View logs: docker logs -f acquisition-app-prod"
echo "   Stop app: docker compose -f docker-compose.prod.yml down"

