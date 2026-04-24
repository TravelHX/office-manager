# UI Tests Runner Script (PowerShell)
# This script runs UI (frontend) tests only using Docker Compose

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Running UI Tests in Docker" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is available
Write-Host "Checking Docker availability..." -ForegroundColor Yellow
$ErrorActionPreference = "Continue"
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker command failed"
    }
    Write-Host "Docker is available: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "ERROR: Docker is not available or Docker Desktop is not running!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please ensure:" -ForegroundColor Yellow
    Write-Host "  1. Docker Desktop is installed" -ForegroundColor White
    Write-Host "  2. Docker Desktop is running" -ForegroundColor White
    Write-Host "  3. Docker Desktop has finished starting up" -ForegroundColor White
    Write-Host ""
    Write-Host "You can start Docker Desktop from the Start menu or system tray." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Check if Docker daemon is accessible
try {
    $dockerInfo = docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker daemon not accessible"
    }
} catch {
    Write-Host ""
    Write-Host "ERROR: Cannot connect to Docker daemon!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Docker Desktop may still be starting up. Please wait a moment and try again." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

$ErrorActionPreference = "Stop"
Write-Host ""

# Stop any existing test containers
Write-Host "Stopping any existing test containers..." -ForegroundColor Yellow
$ErrorActionPreference = "Continue"
docker-compose -f docker-compose.test.yml down 2>&1 | Out-Null
$ErrorActionPreference = "Stop"

Write-Host ""

# Build test containers
Write-Host "Building test containers..." -ForegroundColor Yellow
Write-Host "This may take several minutes, especially on first run..." -ForegroundColor Gray
Write-Host "Note: npm install may timeout if network is slow. If it fails, try again." -ForegroundColor Gray
Write-Host ""

$maxRetries = 2
$retryCount = 0
$buildExitCode = 1
$buildOutput = ""

while ($retryCount -le $maxRetries -and $buildExitCode -ne 0) {
    if ($retryCount -gt 0) {
        Write-Host ""
        Write-Host "Retry attempt $retryCount of $maxRetries..." -ForegroundColor Yellow
        Write-Host "Waiting 5 seconds before retry..." -ForegroundColor Gray
        Start-Sleep -Seconds 5
    }
    
    $buildOutput = docker-compose -f docker-compose.test.yml build 2>&1
    $buildExitCode = $LASTEXITCODE
    
    if ($buildExitCode -eq 0) {
        break
    }
    
    $retryCount++
}

if ($buildExitCode -ne 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "ERROR: Failed to build test containers!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    
    # Check for specific error types
    if ($buildOutput -match "ETIMEDOUT|network.*timeout|network.*connectivity|read ETIMEDOUT") {
        Write-Host "Network timeout detected during npm install." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "The build failed after $($retryCount + 1) attempt(s)." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Possible solutions:" -ForegroundColor Cyan
        Write-Host "  1. Check your internet connection" -ForegroundColor White
        Write-Host "  2. If behind a proxy, configure Docker proxy settings:" -ForegroundColor White
        Write-Host "     - Docker Desktop > Settings > Resources > Proxies" -ForegroundColor Gray
        Write-Host "  3. Try building manually with increased timeout:" -ForegroundColor White
        Write-Host "     docker-compose -f docker-compose.test.yml build --no-cache" -ForegroundColor Gray
        Write-Host "  4. Check npm registry connectivity:" -ForegroundColor White
        Write-Host "     docker run --rm node:18-alpine npm config get registry" -ForegroundColor Gray
        Write-Host "  5. Try using a different npm registry (if corporate firewall blocks default)" -ForegroundColor White
    } elseif ($buildOutput -match "npm error") {
        Write-Host "npm error detected during package installation." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Possible solutions:" -ForegroundColor Cyan
        Write-Host "  1. Clear npm cache: docker run --rm node:18-alpine npm cache clean --force" -ForegroundColor White
        Write-Host "  2. Try rebuilding without cache: docker-compose -f docker-compose.test.yml build --no-cache" -ForegroundColor White
        Write-Host "  3. Check npm registry connectivity" -ForegroundColor White
    } else {
        Write-Host "Build failed. Check the error output above for details." -ForegroundColor Yellow
    }
    
    Write-Host ""
    exit 1
}

Write-Host "Build completed successfully!" -ForegroundColor Green

Write-Host ""

# Run UI tests in Docker
Write-Host "Starting test environment and running UI tests..." -ForegroundColor Yellow
Write-Host ""

# List all UI test files that will be run
Write-Host "Discovering UI test files..." -ForegroundColor Cyan
# Suppress Docker Compose network creation messages and capture only test file paths
$ErrorActionPreference = "SilentlyContinue"
$testFilesOutput = docker-compose -f docker-compose.test.yml run --rm test-backend sh -c "cd src/frontend && find tests -name '*.test.js' -type f 2>/dev/null | sort" 2>&1
$testFiles = $testFilesOutput | Where-Object { 
    $_ -and 
    $_ -match 'tests/.*\.test\.js' -and 
    $_ -notmatch '^[A-Z]' -and
    $_ -notmatch '^Network' -and
    $_ -notmatch '^Creating' -and
    $_ -notmatch 'docker-compose' -and
    $_.Trim() -match '^tests/.*\.test\.js$'
}
$ErrorActionPreference = "Stop"

# Expected test files
# Note: `tests/overtime.test.js` was dropped in Phase 23a (overtime removal);
# do not re-add it.
$expectedTests = @(
    'tests/admin.test.js',
    'tests/auth-state.test.js',
    'tests/bookings.test.js',
    'tests/desk-booking.test.js',
    'tests/forgot-password.test.js',
    'tests/login.test.js',
    'tests/main.test.js',
    'tests/matrix.test.js',
    'tests/parking.test.js',
    'tests/reset-password.test.js',
    'tests/user-creation-form.test.js'
)

if ($testFiles) {
    Write-Host "Found $($testFiles.Count) test file(s):" -ForegroundColor Green
    $testFiles | ForEach-Object {
        $testFile = $_.Trim()
        Write-Host "  - $testFile" -ForegroundColor Gray
    }
    
    # Verify all expected tests are found
    $foundTests = $testFiles | ForEach-Object { $_.Trim() }
    $missingTests = $expectedTests | Where-Object { $foundTests -notcontains $_ }
    
    if ($missingTests) {
        Write-Host ""
        Write-Host "Warning: The following expected test files were not found:" -ForegroundColor Yellow
        $missingTests | ForEach-Object {
            Write-Host "  - $_" -ForegroundColor Yellow
        }
    } else {
        Write-Host ""
        Write-Host "All expected test files found!" -ForegroundColor Green
    }
} else {
    Write-Host "Warning: No test files found matching pattern 'tests/**/*.test.js'" -ForegroundColor Yellow
    Write-Host "Expected test files:" -ForegroundColor Yellow
    $expectedTests | ForEach-Object {
        Write-Host "  - $_" -ForegroundColor Yellow
    }
}

Write-Host ""

# Run UI tests with verbose output
Write-Host "Running UI tests..." -ForegroundColor Cyan
$ErrorActionPreference = "Continue"
docker-compose -f docker-compose.test.yml run --rm test-backend sh -c "echo 'Waiting for database to be ready...' && sleep 5 && cd src/frontend && npx jest --config jest.config.js --verbose"
$ErrorActionPreference = "Stop"

$testExitCode = $LASTEXITCODE

Write-Host ""

# Cleanup
Write-Host "Cleaning up test containers..." -ForegroundColor Yellow
$ErrorActionPreference = "Continue"
docker-compose -f docker-compose.test.yml down 2>&1 | Out-Null
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($testExitCode -eq 0) {
    Write-Host "UI tests completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "All UI test files executed:" -ForegroundColor Green
    if ($testFiles) {
        $testFiles | ForEach-Object {
            Write-Host "  [OK] $($_.Trim())" -ForegroundColor Green
        }
    }
} else {
    Write-Host "UI tests failed with exit code: $testExitCode" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please review the test output above for details." -ForegroundColor Yellow
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

exit $testExitCode

