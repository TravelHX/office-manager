# Integration Tests Runner Script (PowerShell)
# This script runs integration tests only using Docker Compose

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Running Integration Tests in Docker" -ForegroundColor Cyan
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

# Run integration tests in Docker
Write-Host "Starting test environment and running integration tests..." -ForegroundColor Yellow
Write-Host ""

docker-compose -f docker-compose.test.yml run --rm test-backend sh -c "echo 'Waiting for database to be ready...' && sleep 5 && npm test -- --testPathPattern='tests/integration'"

$testExitCode = $LASTEXITCODE

Write-Host ""

# Cleanup
Write-Host "Cleaning up test containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.test.yml down

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($testExitCode -eq 0) {
    Write-Host "Integration tests completed successfully!" -ForegroundColor Green
} else {
    Write-Host "Integration tests failed with exit code: $testExitCode" -ForegroundColor Red
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

exit $testExitCode

