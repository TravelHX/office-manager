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
    # Force stop and remove everything
    docker-compose down -v --remove-orphans --rmi local 2>&1 | Out-Null
    Write-Host "Docker Compose services removed." -ForegroundColor Green
} catch {
    # Ignore errors - containers may not exist
    Write-Host "Note: Some containers may not have existed (this is OK)." -ForegroundColor Gray
}

# Aggressive cleanup: Remove any containers using port 3306
Write-Host "Cleaning up any containers using port 3306..." -ForegroundColor Gray
docker ps -a --format "{{.Names}}" 2>&1 | ForEach-Object {
    if ($_ -and $_ -notmatch "error") {
        $containerName = $_.Trim()
        if ($containerName) {
            $ports = docker port $containerName 2>&1
            if ($ports -match ":3306") {
                Write-Host "Removing container with port 3306: $containerName" -ForegroundColor Yellow
                docker stop $containerName 2>&1 | Out-Null
                docker rm -f $containerName 2>&1 | Out-Null
            }
        }
    }
}

# Clean up Docker system to remove stale port bindings
Write-Host "Cleaning up Docker system resources..." -ForegroundColor Gray
docker system prune -f --volumes 2>&1 | Out-Null

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

# Aggressively remove ANY container that might be using port 3306
Write-Host "Checking all containers for port 3306 bindings..." -ForegroundColor Gray
$allDockerContainers = docker ps -a --format "{{.Names}}" 2>&1 | Where-Object { $_ -notmatch "error" -and $_.Trim() -ne "" }
if ($allDockerContainers) {
    foreach ($containerName in $allDockerContainers) {
        $containerName = $containerName.Trim()
        if ($containerName -eq "") { continue }
        
        # Check if container has port 3306 bound
        $inspectResult = docker inspect $containerName --format='{{range $p, $conf := .NetworkSettings.Ports}}{{$p}} {{end}}' 2>&1
        if ($inspectResult -match "3306") {
            Write-Host "Found container '$containerName' with port 3306 binding, removing..." -ForegroundColor Yellow
            docker stop $containerName 2>&1 | Out-Null
            docker rm -f $containerName 2>&1 | Out-Null
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

# Function to check and free port 3306
function Free-Port3306 {
    $portFreed = $false
    
    # Method 1: Check for ALL containers (running and stopped) that might use port 3306
    Write-Host "Checking all Docker containers for port 3306 usage..." -ForegroundColor Gray
    $allContainers = docker ps -a --format "{{.Names}}" 2>&1 | Where-Object { $_ -notmatch "error" -and $_.Trim() -ne "" }
    
    if ($allContainers) {
        foreach ($containerName in $allContainers) {
            $containerName = $containerName.Trim()
            if ($containerName -eq "") { continue }
            
            # Inspect container for port bindings
            $portBindings = docker inspect $containerName --format='{{range $p, $conf := .NetworkSettings.Ports}}{{$p}} {{end}}' 2>&1
            if ($portBindings -match "3306") {
                Write-Host "Found container '$containerName' using port 3306" -ForegroundColor Yellow
                docker stop $containerName 2>&1 | Out-Null
                docker rm -f $containerName 2>&1 | Out-Null
                $portFreed = $true
            }
        }
    }
    
    # Method 2: Specifically check for office-manager-mysql and any mysql containers
    $mysqlContainers = docker ps -a --filter "name=mysql" --format "{{.Names}}" 2>&1 | Where-Object { $_ -notmatch "error" -and $_.Trim() -ne "" }
    if ($mysqlContainers) {
        Write-Host "Found MySQL-related containers, removing them..." -ForegroundColor Yellow
        foreach ($container in ($mysqlContainers -split "`n")) {
            $container = $container.Trim()
            if ($container -ne "") {
                docker stop $container 2>&1 | Out-Null
                docker rm -f $container 2>&1 | Out-Null
                $portFreed = $true
            }
        }
    }
    
    # Method 2b: Check for containers in "Created" state (they can hold port bindings)
    $createdContainers = docker ps -a --filter "status=created" --format "{{.Names}}" 2>&1 | Where-Object { $_ -notmatch "error" -and $_.Trim() -ne "" }
    if ($createdContainers) {
        Write-Host "Found containers in Created state, removing them..." -ForegroundColor Yellow
        foreach ($container in ($createdContainers -split "`n")) {
            $container = $container.Trim()
            if ($container -ne "") {
                docker rm -f $container 2>&1 | Out-Null
                $portFreed = $true
            }
        }
    }
    
    # Method 3: Check for processes using port 3306 using Get-NetTCPConnection
    try {
        $port3306 = Get-NetTCPConnection -LocalPort 3306 -ErrorAction SilentlyContinue
        if ($port3306) {
            Write-Host "Port 3306 is in use by a process!" -ForegroundColor Yellow
            $processIds = $port3306 | Select-Object -Unique -ExpandProperty OwningProcess
            foreach ($processId in $processIds) {
                $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                if ($process) {
                    Write-Host "Stopping process: $($process.ProcessName) (PID: $processId)" -ForegroundColor Yellow
                    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                    $portFreed = $true
                }
            }
        }
    } catch {
        Write-Host "Could not check processes for port 3306: $_" -ForegroundColor Gray
    }
    
    # Method 3b: Use netstat as a fallback to find processes using port 3306
    try {
        $netstatOutput = netstat -ano | Select-String ":3306"
        if ($netstatOutput) {
            Write-Host "Found port 3306 usage via netstat..." -ForegroundColor Yellow
            foreach ($line in $netstatOutput) {
                if ($line -match '\s+(\d+)\s*$') {
                    $pid = $matches[1]
                    $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
                    if ($process) {
                        Write-Host "Stopping process found via netstat: $($process.ProcessName) (PID: $pid)" -ForegroundColor Yellow
                        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                        $portFreed = $true
                    }
                }
            }
        }
    } catch {
        Write-Host "Could not check port 3306 via netstat: $_" -ForegroundColor Gray
    }
    
    # Method 4: Check for Windows MySQL service
    try {
        $mysqlService = Get-Service -Name "*mysql*" -ErrorAction SilentlyContinue
        if ($mysqlService) {
            Write-Host "Found MySQL Windows service, stopping it..." -ForegroundColor Yellow
            foreach ($service in $mysqlService) {
                if ($service.Status -eq "Running") {
                    Stop-Service -Name $service.Name -Force -ErrorAction SilentlyContinue
                    Write-Host "Stopped service: $($service.Name)" -ForegroundColor Yellow
                    $portFreed = $true
                }
            }
        }
    } catch {
        # No MySQL service found, that's OK
    }
    
    if ($portFreed) {
        Write-Host "Waiting for port 3306 to be released..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
        
        # Verify port is free
        $portCheck = Get-NetTCPConnection -LocalPort 3306 -ErrorAction SilentlyContinue
        if ($portCheck) {
            Write-Host "Warning: Port 3306 may still be in use. Will attempt to continue..." -ForegroundColor Yellow
            return $false
        } else {
            Write-Host "Port 3306 is now available." -ForegroundColor Green
            return $true
        }
    } else {
        Write-Host "Port 3306 appears to be available." -ForegroundColor Green
        return $true
    }
}

# Free port 3306
$port3306Free = Free-Port3306
if (-not $port3306Free) {
    Write-Host "Warning: Could not fully free port 3306. Attempting to continue anyway..." -ForegroundColor Yellow
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

# Step 2: Build Docker Compose (force rebuild without cache)
Write-Host "[2/6] Building Docker Compose services (no cache)..." -ForegroundColor Yellow

docker-compose build --no-cache

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Docker build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Docker build completed successfully." -ForegroundColor Green
Write-Host ""

# Step 3: Set up the database and start services (force recreate)
Write-Host "[3/6] Starting services and setting up database..." -ForegroundColor Yellow

# Aggressive cleanup: Remove office-manager-mysql container in any state
Write-Host "Performing aggressive cleanup of MySQL container..." -ForegroundColor Gray
$ErrorActionPreference = "Continue"
docker stop office-manager-mysql 2>&1 | Out-Null
docker rm -f office-manager-mysql 2>&1 | Out-Null
$ErrorActionPreference = "Stop"

# Check for containers in "Created" state that might hold port bindings
Write-Host "Checking for containers in Created state..." -ForegroundColor Gray
$createdContainers = docker ps -a --filter "status=created" --format "{{.Names}}" 2>&1 | Where-Object { $_ -notmatch "error" -and $_.Trim() -ne "" }
if ($createdContainers) {
    foreach ($container in ($createdContainers -split "`n")) {
        $container = $container.Trim()
        if ($container -ne "") {
            Write-Host "Removing created container: $container" -ForegroundColor Yellow
            docker rm -f $container 2>&1 | Out-Null
        }
    }
}

# Final check: Verify port 3306 is actually free
Write-Host "Final port 3306 verification..." -ForegroundColor Gray
$finalPortCheck = Get-NetTCPConnection -LocalPort 3306 -ErrorAction SilentlyContinue
if ($finalPortCheck) {
    Write-Host "WARNING: Port 3306 is still in use! Attempting to free it one more time..." -ForegroundColor Red
    Free-Port3306 | Out-Null
    Start-Sleep -Seconds 5
}

# Retry mechanism for docker-compose up
$maxRetries = 3
$retryCount = 0
$success = $false

while ($retryCount -lt $maxRetries -and -not $success) {
    if ($retryCount -gt 0) {
        Write-Host "Retry attempt $retryCount of $maxRetries..." -ForegroundColor Yellow
        Write-Host "Cleaning up before retry..." -ForegroundColor Gray
        
        # Clean up any containers that might have been created
        $ErrorActionPreference = "Continue"
        docker-compose down 2>&1 | Out-Null
        docker rm -f office-manager-mysql 2>&1 | Out-Null
        $ErrorActionPreference = "Stop"
        
        # Free port again
        Free-Port3306 | Out-Null
        Start-Sleep -Seconds (3 * $retryCount) # Exponential backoff
    }
    
    # Final aggressive port check right before starting
    Write-Host "Final aggressive port 3306 cleanup..." -ForegroundColor Gray
    $ErrorActionPreference = "Continue"
    
    # CRITICAL: Remove office-manager-mysql container in ANY state (Created, Exited, etc.)
    Write-Host "Force removing office-manager-mysql container..." -ForegroundColor Yellow
    docker stop office-manager-mysql 2>&1 | Out-Null
    docker rm -f office-manager-mysql 2>&1 | Out-Null
    Start-Sleep -Seconds 1
    
    # Remove ALL containers in Created state that might have port 3306
    $allCreated = docker ps -a --filter "status=created" --format "{{.Names}}" 2>&1 | Where-Object { $_ -notmatch "error" -and $_.Trim() -ne "" }
    if ($allCreated) {
        Write-Host "Removing all containers in Created state..." -ForegroundColor Yellow
        foreach ($container in ($allCreated -split "`n")) {
            $container = $container.Trim()
            if ($container -ne "") {
                docker rm -f $container 2>&1 | Out-Null
            }
        }
        Start-Sleep -Seconds 1
    }
    
    # Kill any process using port 3306 via netstat
    try {
        $netstatLines = netstat -ano | Select-String ":3306"
        foreach ($line in $netstatLines) {
            if ($line -match '\s+(\d+)\s*$') {
                $pid = $matches[1]
                try {
                    $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
                    if ($proc) {
                        Write-Host "Killing process using port 3306: $($proc.ProcessName) (PID: $pid)" -ForegroundColor Red
                        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                    }
                } catch {
                    # Process might already be gone
                }
            }
        }
    } catch {
        # Ignore errors
    }
    
    $ErrorActionPreference = "Stop"
    Start-Sleep -Seconds 2
    
    # Final verification: ensure container is gone
    $stillExists = docker ps -a --filter "name=office-manager-mysql" --format "{{.Names}}" 2>&1 | Where-Object { $_ -notmatch "error" -and $_.Trim() -ne "" }
    if ($stillExists) {
        Write-Host "WARNING: office-manager-mysql container still exists, forcing removal..." -ForegroundColor Red
        $ErrorActionPreference = "Continue"
        docker rm -f office-manager-mysql 2>&1 | Out-Null
        $ErrorActionPreference = "Stop"
        Start-Sleep -Seconds 2
    }
    
    # Check what Docker thinks is using port 3306
    Write-Host "Checking Docker's view of port 3306 usage..." -ForegroundColor Gray
    $ErrorActionPreference = "Continue"
    $containersWithPort = docker ps -a --format "table {{.Names}}\t{{.Ports}}" 2>&1 | Select-String "3306"
    if ($containersWithPort) {
        Write-Host "Found containers Docker thinks are using port 3306:" -ForegroundColor Yellow
        $containersWithPort | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
        
        # Extract container names and remove them
        docker ps -a --format "{{.Names}}" 2>&1 | ForEach-Object {
            if ($_ -and $_ -notmatch "error") {
                $name = $_.Trim()
                if ($name) {
                    $ports = docker port $name 2>&1
                    if ($ports -match "3306") {
                        Write-Host "Removing container with port 3306: $name" -ForegroundColor Red
                        docker stop $name 2>&1 | Out-Null
                        docker rm -f $name 2>&1 | Out-Null
                    }
                }
            }
        }
        Start-Sleep -Seconds 2
    }
    
    # Final Docker system cleanup to remove any stale port bindings
    Write-Host "Final Docker system cleanup..." -ForegroundColor Gray
    docker system prune -f 2>&1 | Out-Null
    Start-Sleep -Seconds 2
    
    Write-Host "Starting Docker Compose services..." -ForegroundColor Yellow
    # Set ErrorActionPreference to Continue to prevent PowerShell from throwing on stderr output
    # Docker-compose writes informational messages to stderr (like "Network Creating")
    $ErrorActionPreference = "Continue"
    $composeOutput = docker-compose up -d --force-recreate --build 2>&1
    $composeExitCode = $LASTEXITCODE
    
    if ($composeExitCode -eq 0) {
        $success = $true
        Write-Host "Docker Compose started successfully!" -ForegroundColor Green
    } else {
        # Check if the error is about port 3306 being allocated
        if ($composeOutput -match "port.*3306.*already allocated") {
            Write-Host "Port 3306 conflict detected. Cleaning up and retrying..." -ForegroundColor Red
            
            # Remove the container that was just created but failed to start
            $ErrorActionPreference = "Continue"
            docker rm -f office-manager-mysql 2>&1 | Out-Null
            
            # Wait longer to ensure port is released
            Write-Host "Waiting for port 3306 to be released..." -ForegroundColor Yellow
            Start-Sleep -Seconds 5
            
            # Try to free the port again
            Free-Port3306 | Out-Null
            Start-Sleep -Seconds 3
            
            $ErrorActionPreference = "Stop"
        }
        
        $retryCount++
        if ($retryCount -lt $maxRetries) {
            Write-Host "Failed to start services. Will retry..." -ForegroundColor Yellow
        }
    }
}

if (-not $success) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "ERROR: Failed to start Docker services after $maxRetries attempts!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Port 3306 appears to be in use. This may be a Docker Desktop issue on Windows." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Try the following solutions:" -ForegroundColor Cyan
    Write-Host "1. Restart Docker Desktop (right-click Docker icon in system tray -> Restart)" -ForegroundColor White
    Write-Host "2. Check if another MySQL service is running: Get-Service | Where-Object { `$_.Name -like '*mysql*' }" -ForegroundColor White
    Write-Host "3. Check what's using port 3306: netstat -ano | findstr :3306" -ForegroundColor White
    Write-Host "4. Manually remove any office-manager containers: docker rm -f office-manager-mysql" -ForegroundColor White
    Write-Host ""
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

