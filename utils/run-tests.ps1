# Test runner script for Docker environment (PowerShell)
# This script runs ALL tests (unit, integration, and UI tests) using Docker Compose

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Running All Tests in Docker" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Stop any existing test containers
Write-Host "Stopping any existing test containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.test.yml down 2>$null | Out-Null

Write-Host ""

# Build test containers
Write-Host "Building test containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.test.yml build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to build test containers!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Run all tests in Docker (unit + integration + UI)
Write-Host "Starting test environment and running all tests..." -ForegroundColor Yellow
Write-Host ""

# First run backend tests (unit + integration)
Write-Host "Running backend tests (unit + integration)..." -ForegroundColor Yellow
docker-compose -f docker-compose.test.yml run --rm test-backend sh -c "echo 'Waiting for database to be ready...' && sleep 5 && npm test"

$backendTestExitCode = $LASTEXITCODE

if ($backendTestExitCode -ne 0) {
    Write-Host ""
    Write-Host "Backend tests failed!" -ForegroundColor Red
} else {
    Write-Host ""
    Write-Host "Backend tests passed!" -ForegroundColor Green
}

Write-Host ""

# Then run UI tests
Write-Host "Running UI tests..." -ForegroundColor Yellow
docker-compose -f docker-compose.test.yml run --rm test-backend sh -c "cd src/frontend && npx jest --config jest.config.js"

$uiTestExitCode = $LASTEXITCODE

if ($uiTestExitCode -ne 0) {
    Write-Host ""
    Write-Host "UI tests failed!" -ForegroundColor Red
} else {
    Write-Host ""
    Write-Host "UI tests passed!" -ForegroundColor Green
}

Write-Host ""

# Cleanup
Write-Host "Cleaning up test containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.test.yml down

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($backendTestExitCode -eq 0 -and $uiTestExitCode -eq 0) {
    Write-Host "All tests completed successfully!" -ForegroundColor Green
    $overallExitCode = 0
} else {
    Write-Host "Some tests failed!" -ForegroundColor Red
    if ($backendTestExitCode -ne 0) {
        Write-Host "  - Backend tests failed (exit code: $backendTestExitCode)" -ForegroundColor Red
    }
    if ($uiTestExitCode -ne 0) {
        Write-Host "  - UI tests failed (exit code: $uiTestExitCode)" -ForegroundColor Red
    }
    $overallExitCode = 1
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

exit $overallExitCode
