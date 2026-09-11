$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
Write-Host ""
Write-Host "========================================"
Write-Host "     PROJECT CONTROL - STARTING"
Write-Host "========================================"
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js was not found. Install the current Node.js LTS release from https://nodejs.org/ and run this script again."
    exit 1
}

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies for the first run..."
    npm install
}

Write-Host ""
Write-Host "Dashboard: http://localhost:3000"
Write-Host "Press Ctrl+C to stop it."
Write-Host ""
npm run dev
