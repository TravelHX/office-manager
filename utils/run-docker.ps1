# Office Manager Docker Development Environment Script
# This script starts the development environment using Docker Compose

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Office Manager - Development Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will tear down any existing Docker setup and start fresh." -ForegroundColor Yellow
Write-Host "All containers, volumes, and networks will be removed." -ForegroundColor Yellow
Write-Host ""

# Step 1: Complete teardown of Docker setup
Write-Host "[1/6] Tearing down existing Docker setup..." -ForegroundColor Yellow

# Stop and remove all containers, volumes, and networks
Write-Host "Stopping and removing containers, volumes, and networks..." -ForegroundColor Yellow
$ErrorActionPreference = "Continue"
try {
    $output = docker-compose down -v --remove-orphans 2>&1
    $output | Out-Null
} catch {
    # Ignore errors - containers may not exist
}
$ErrorActionPreference = "Stop"

# Remove any orphaned containers with office-manager in the name
$allContainers = docker ps -a --filter "name=office-manager" --format "{{.Names}}" 2>&1 | Where-Object { $_ -notmatch "error" }
if ($allContainers) {
    Write-Host "Removing orphaned containers..." -ForegroundColor Yellow
    $containers = $allContainers -split "`n"
    foreach ($container in $containers) {
        if ($container.Trim() -and $container.Trim() -ne "") {
            docker stop $container.Trim() 2>&1 | Out-Null
            docker rm -f $container.Trim() 2>&1 | Out-Null
        }
    }
}

# Remove any orphaned networks
$networks = docker network ls --filter "name=office-manager" --format "{{.Name}}" 2>&1 | Where-Object { $_ -notmatch "error" }
if ($networks) {
    Write-Host "Removing orphaned networks..." -ForegroundColor Yellow
    $networkList = $networks -split "`n"
    foreach ($network in $networkList) {
        if ($network.Trim() -and $network.Trim() -ne "") {
            docker network rm $network.Trim() 2>&1 | Out-Null
        }
    }
}

# Remove volumes if they exist
$volumes = docker volume ls --filter "name=office-manager" --format "{{.Name}}" 2>&1 | Where-Object { $_ -notmatch "error" }
if ($volumes) {
    Write-Host "Removing volumes..." -ForegroundColor Yellow
    $volumeList = $volumes -split "`n"
    foreach ($volume in $volumeList) {
        if ($volume.Trim() -and $volume.Trim() -ne "") {
            docker volume rm $volume.Trim() 2>&1 | Out-Null
        }
    }
}

Write-Host "Docker setup torn down completely." -ForegroundColor Green
Write-Host ""

# Check for port 3000 usage
Write-Host "Checking if port 3000 is available..." -ForegroundColor Yellow

# Check for Docker containers using port 3000
$containersUsingPort = docker ps --filter "publish=3000" --format "{{.Names}}" 2>&1 | Where-Object { $_ -notmatch "error" }
if ($containersUsingPort -and $containersUsingPort.Trim() -ne "") {
    Write-Host "Found Docker containers using port 3000: $containersUsingPort" -ForegroundColor Yellow
    Write-Host "Stopping containers..." -ForegroundColor Yellow
    $containers = $containersUsingPort -split "`n"
    foreach ($container in $containers) {
        if ($container.Trim() -and $container.Trim() -ne "") {
            docker stop $container.Trim() 2>&1 | Out-Null
            docker rm -f $container.Trim() 2>&1 | Out-Null
        }
    }
    Start-Sleep -Seconds 2
}

# Check for port 3306 usage (MySQL)
Write-Host "Checking if port 3306 is available..." -ForegroundColor Yellow
$containersUsingPort3306 = docker ps --filter "publish=3306" --format "{{.Names}}" 2>&1 | Where-Object { $_ -notmatch "error" }
if ($containersUsingPort3306 -and $containersUsingPort3306.Trim() -ne "") {
    Write-Host "Found Docker containers using port 3306: $containersUsingPort3306" -ForegroundColor Yellow
    Write-Host "Stopping containers..." -ForegroundColor Yellow
    $containers = $containersUsingPort3306 -split "`n"
    foreach ($container in $containers) {
        if ($container.Trim() -and $container.Trim() -ne "") {
            docker stop $container.Trim() 2>&1 | Out-Null
            docker rm -f $container.Trim() 2>&1 | Out-Null
        }
    }
    Start-Sleep -Seconds 2
}

# Check for processes using port 3000
try {
    $port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
    if ($port3000) {
        Write-Host "Port 3000 is already in use by a process!" -ForegroundColor Yellow
        Write-Host "Automatically stopping the process..." -ForegroundColor Yellow
        
        $processIds = $port3000 | Select-Object -Unique -ExpandProperty OwningProcess
        foreach ($processId in $processIds) {
            $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($process) {
                Write-Host "Stopping process: $($process.ProcessName) (PID: $processId)" -ForegroundColor Yellow
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            }
        }
        
        Start-Sleep -Seconds 2
        
        # Verify port is now free
        $portCheck = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
        if ($portCheck) {
            Write-Host "Warning: Port 3000 may still be in use. Continuing anyway..." -ForegroundColor Yellow
        } else {
            Write-Host "Port 3000 is now available." -ForegroundColor Green
        }
    } else {
        Write-Host "Port 3000 is available." -ForegroundColor Green
    }
} catch {
    Write-Host "Could not check port 3000 status. Continuing..." -ForegroundColor Yellow
}

Write-Host "Ports are available. Ready for fresh setup." -ForegroundColor Green
Write-Host ""

# Step 2: Build Docker Compose
Write-Host "[2/6] Building Docker Compose services..." -ForegroundColor Yellow

docker-compose build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Docker build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Docker build completed successfully." -ForegroundColor Green
Write-Host ""

# Step 3: Set up the database and start services
Write-Host "[3/6] Starting services and setting up database..." -ForegroundColor Yellow

docker-compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to start Docker services!" -ForegroundColor Red
    exit 1
}

Write-Host "Services started. Waiting for database to be ready..." -ForegroundColor Yellow

# Wait for MySQL to be healthy
$maxAttempts = 30
$attempt = 0
$dbReady = $false

while ($attempt -lt $maxAttempts -and -not $dbReady) {
    Start-Sleep -Seconds 2
    $healthCheck = docker inspect --format='{{.State.Health.Status}}' office-manager-mysql 2>$null
    
    if ($healthCheck -eq "healthy") {
        $dbReady = $true
        Write-Host "Database is ready!" -ForegroundColor Green
    } else {
        $attempt++
        Write-Host "Waiting for database... (attempt $attempt/$maxAttempts)" -ForegroundColor Gray
    }
}

if (-not $dbReady) {
    Write-Host "Warning: Database may not be fully ready, but continuing..." -ForegroundColor Yellow
}

Write-Host ""

# Step 4: Verify backend is running
Write-Host "[4/6] Verifying backend service..." -ForegroundColor Yellow

$maxAttempts = 20
$attempt = 0
$backendReady = $false

while ($attempt -lt $maxAttempts -and -not $backendReady) {
    Start-Sleep -Seconds 1
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $backendReady = $true
            Write-Host "Backend is running!" -ForegroundColor Green
        }
    } catch {
        $attempt++
        Write-Host "Waiting for backend... (attempt $attempt/$maxAttempts)" -ForegroundColor Gray
    }
}

if (-not $backendReady) {
    Write-Host "Warning: Backend may not be fully ready, but continuing..." -ForegroundColor Yellow
}

Write-Host ""

# Step 5: Frontend is served by backend (static files)
Write-Host "[5/6] Frontend is served by backend on port 3000" -ForegroundColor Green
Write-Host ""

# Step 6: Launch browser
Write-Host "[6/6] Launching browser..." -ForegroundColor Yellow

$frontendUrl = "http://localhost:3000"

Start-Sleep -Seconds 2

try {
    Start-Process $frontendUrl
    Write-Host "Browser launched successfully!" -ForegroundColor Green
} catch {
    Write-Host "Warning: Could not launch browser automatically. Please open: $frontendUrl" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Frontend URL: $frontendUrl" -ForegroundColor Cyan
Write-Host "Backend API: http://localhost:3000/api" -ForegroundColor Cyan
Write-Host ""
Write-Host "To view logs: docker-compose logs -f" -ForegroundColor Gray
Write-Host "To stop services: docker-compose down" -ForegroundColor Gray
Write-Host ""

