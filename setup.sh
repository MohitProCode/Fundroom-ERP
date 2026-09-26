#!/bin/bash

echo "========================================"
echo "Fundroom ERP - Full Setup"
echo "========================================"

# Root directory
cd "$(dirname "$0")"

# Install root dependencies
echo ""
echo "Step 1: Installing root dependencies..."
npm install

# Setup backend
echo ""
echo "Step 2: Setting up backend..."
cd apps/api

# Install backend dependencies
echo "Installing backend dependencies..."
npm install

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Check for .env
if [ ! -f .env ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo ""
    echo "IMPORTANT: Edit apps/api/.env with your database credentials"
    echo ""
fi

# Setup database
echo ""
echo "Step 3: Setting up database..."
echo "Make sure PostgreSQL is running (docker-compose up -d)"
read -p "Press Enter when database is ready..."

# Run migrations
echo "Running migrations..."
npx prisma migrate dev --name init

# Seed database
echo "Seeding database..."
npx prisma db seed

# Setup frontend
echo ""
echo "Step 4: Setting up frontend..."
cd ../web

echo "Installing frontend dependencies..."
npm install

echo ""
echo "========================================"
echo "Setup complete!"
echo "========================================"
echo ""
echo "To start the application:"
echo "  Terminal 1 (Backend): cd apps/api && npm run dev"
echo "  Terminal 2 (Frontend): cd apps/web && npm run dev"
echo ""
echo "Test credentials:"
echo "  Admin: admin@fundroom.com / Admin@123"
echo "  Sales: sales@fundroom.com / Sales@123"
echo ""
