@echo off
echo ========================================
echo Fundroom ERP - Backend Setup
echo ========================================

echo.
echo Step 1: Installing backend dependencies...
cd apps\api
call npm install

echo.
echo Step 2: Generating Prisma client...
call npx prisma generate

echo.
echo Step 3: Setting up database...
echo Make sure PostgreSQL is running (docker-compose up -d)
echo.

REM Check if .env exists
if not exist .env (
    echo Creating .env from .env.example...
    copy .env.example .env
    echo.
    echo IMPORTANT: Edit apps\api\.env with your database credentials
    echo.
)

echo Step 4: Running database migrations...
call npx prisma migrate dev --name init

echo.
echo Step 5: Seeding database...
call npx prisma db seed

echo.
echo ========================================
echo Backend setup complete!
echo ========================================
echo.
echo To start the backend server:
echo   cd apps\api
echo   npm run dev
echo.
echo Test credentials:
echo   Admin: admin@fundroom.com / Admin@123
echo   Sales: sales@fundroom.com / Sales@123
echo.
pause
