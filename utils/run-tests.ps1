# Test runner script for Docker environment (PowerShell)
# This script runs ALL tests (unit, integration, and UI tests) using Docker Compose

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Running All Tests in Docker" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Stop any existing test containers
Write-Host "Stopping any existing test containers..." -ForegroundColor Yellow
try {
    docker-compose -f docker-compose.test.yml down 2>&1 | Out-Null
} catch {
    # Ignore errors when stopping containers that don't exist
}

Write-Host ""

# Build test containers
Write-Host "Building test containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.test.yml build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to build test containers!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Start all test services together to ensure proper networking
Write-Host "Starting test environment..." -ForegroundColor Yellow
docker-compose -f docker-compose.test.yml up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to start test services!" -ForegroundColor Red
    exit 1
}

# Wait for database to be healthy
Write-Host "Waiting for database to be ready..." -ForegroundColor Yellow
$maxWait = 120
$waited = 0
$healthy = $false

while ($waited -lt $maxWait -and -not $healthy) {
    Start-Sleep -Seconds 2
    $waited += 2
    # Use double-quoted --format so PowerShell does not pass malformed args to docker.exe
    $healthStatus = (docker inspect --format "{{.State.Health.Status}}" office-manager-test-mysql 2>$null)
    if ($null -ne $healthStatus) { $healthStatus = $healthStatus.Trim() }
    if ($healthStatus -eq "healthy") {
        $healthy = $true
        Write-Host "Database is ready!" -ForegroundColor Green
    }
}

if (-not $healthy) {
    Write-Host "Error: Database did not become healthy within $maxWait seconds!" -ForegroundColor Red
    docker-compose -f docker-compose.test.yml down
    exit 1
}

# Wait a bit more for DNS and network to be ready
Write-Host "Waiting for network to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""

# Run all tests in Docker (unit + integration + UI)
Write-Host "Running all tests..." -ForegroundColor Yellow
Write-Host ""

# First run backend tests (unit + integration)
Write-Host "Running backend tests (unit + integration)..." -ForegroundColor Yellow
docker-compose -f docker-compose.test.yml exec -T test-backend sh -c "echo 'Waiting for database to be ready...' && sleep 5 && npm test"

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
docker-compose -f docker-compose.test.yml exec -T test-backend sh -c "cd src/frontend && npx jest --config jest.config.js"

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
