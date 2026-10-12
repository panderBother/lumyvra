param([switch]$SkipModels)
$ErrorActionPreference = 'Stop'
$inferenceRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$vendorRoot = Join-Path $inferenceRoot 'vendor/ACE-Step-1.5'
$servicePython = Join-Path $inferenceRoot '.venv/Scripts/python.exe'
$env:UV_CACHE_DIR = Join-Path $inferenceRoot 'data/uv-cache'
$env:HF_HUB_DISABLE_XET = '1'
Push-Location $inferenceRoot
try {
    uv sync --extra models --extra dev --python 3.12
    if ($LASTEXITCODE -ne 0) { throw 'Service dependency installation failed.' }
    if (-not (Test-Path -LiteralPath (Join-Path $vendorRoot '.git'))) {
        New-Item -ItemType Directory -Path (Split-Path -Parent $vendorRoot) -Force | Out-Null
        git clone https://github.com/ace-step/ACE-Step-1.5.git $vendorRoot
        if ($LASTEXITCODE -ne 0) { throw 'ACE-Step source download failed.' }
    }
    Push-Location $vendorRoot
    try {
        git checkout ca1e85fe9430179831e6bc6be790c332190a3866
        if ($LASTEXITCODE -ne 0) { throw 'Unable to select the verified upstream revision.' }
        uv sync --python 3.12
        if ($LASTEXITCODE -ne 0) { throw 'Native inference dependency installation failed.' }
        # Upstream Windows uses torch 2.7.1; torchao 0.16 targets newer torch.
        # Match the official compatibility table without modifying upstream source.
        uv pip install --python .venv/Scripts/python.exe --no-deps torchao==0.12.0
        if ($LASTEXITCODE -ne 0) { throw 'Windows quantization compatibility installation failed.' }
    } finally { Pop-Location }
    & $servicePython scripts/configure_local.py
    if ($LASTEXITCODE -ne 0) { throw 'Private service configuration failed.' }
    if (-not $SkipModels) {
        & $servicePython scripts/prepare_models.py --download --direct
        if ($LASTEXITCODE -ne 0) { throw 'Model preparation failed; existing downloads remain resumable.' }
    }
    & $servicePython scripts/preflight.py
} finally { Pop-Location }
