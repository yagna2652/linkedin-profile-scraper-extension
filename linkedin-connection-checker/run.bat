@echo off
REM LinkedIn Connection Checker Runner Script for Windows

REM Default values
set SHEET_NAME=Sheet1
set DELAY=3000
set HEADLESS=false
set SPREADSHEET_ID=
set AI_PROVIDER=anthropic

REM Parse command line arguments
:parse_args
if "%~1"=="" goto check_args
if "%~1"=="-s" (
    set SPREADSHEET_ID=%~2
    shift
    shift
    goto parse_args
)
if "%~1"=="--spreadsheet" (
    set SPREADSHEET_ID=%~2
    shift
    shift
    goto parse_args
)
if "%~1"=="-n" (
    set SHEET_NAME=%~2
    shift
    shift
    goto parse_args
)
if "%~1"=="--sheet" (
    set SHEET_NAME=%~2
    shift
    shift
    goto parse_args
)
if "%~1"=="-d" (
    set DELAY=%~2
    shift
    shift
    goto parse_args
)
if "%~1"=="--delay" (
    set DELAY=%~2
    shift
    shift
    goto parse_args
)
if "%~1"=="-h" (
    set HEADLESS=true
    shift
    goto parse_args
)
if "%~1"=="--headless" (
    set HEADLESS=true
    shift
    goto parse_args
)
if "%~1"=="-a" (
    set AI_PROVIDER=%~2
    shift
    shift
    goto parse_args
)
if "%~1"=="--ai" (
    set AI_PROVIDER=%~2
    shift
    shift
    goto parse_args
)
if "%~1"=="--help" (
    goto show_help
)
echo Unknown option: %~1
goto show_help

:check_args
if "%SPREADSHEET_ID%"=="" (
    echo Error: Spreadsheet ID is required
    goto show_help
)

REM Validate AI provider
if not "%AI_PROVIDER%"=="anthropic" (
    if not "%AI_PROVIDER%"=="openai" (
        echo Error: AI provider must be 'anthropic' or 'openai'
        goto show_help
    )
)

REM Create temporary .env file with provided values
echo # LinkedIn Connection Checker Environment Configuration > .env.temp
echo BROWSERBASE_PROJECT_ID=c9488675-4c8f-468a-b113-ffaf27782bab >> .env.temp
echo. >> .env.temp
echo # Google Sheets Configuration >> .env.temp
echo SPREADSHEET_ID=%SPREADSHEET_ID% >> .env.temp
echo SHEET_NAME=%SHEET_NAME% >> .env.temp
echo. >> .env.temp

REM Extract keys from existing .env file
for /f "tokens=2 delims==" %%a in ('findstr "GOOGLE_API_KEY" .env') do (
    echo # Google API Key >> .env.temp
    echo GOOGLE_API_KEY=%%a >> .env.temp
)

echo. >> .env.temp
echo # AI Provider configuration >> .env.temp
echo AI_PROVIDER=%AI_PROVIDER% >> .env.temp
echo. >> .env.temp

echo # API Keys from existing .env file >> .env.temp
for /f "tokens=2 delims==" %%a in ('findstr "ANTHROPIC_API_KEY" .env') do (
    echo ANTHROPIC_API_KEY=%%a >> .env.temp
)

for /f "tokens=2 delims==" %%a in ('findstr "OPENAI_API_KEY" .env') do (
    echo OPENAI_API_KEY=%%a >> .env.temp
)

echo. >> .env.temp
echo # Advanced Settings >> .env.temp
echo PROFILE_CHECK_DELAY=%DELAY% >> .env.temp
echo HEADLESS_BROWSER=%HEADLESS% >> .env.temp

REM Run the program with the temporary .env file
echo Running LinkedIn Connection Checker with:
echo - Spreadsheet ID: %SPREADSHEET_ID%
echo - Sheet Name: %SHEET_NAME%
echo - Delay: %DELAY% ms
echo - Headless: %HEADLESS%
echo - AI Provider: %AI_PROVIDER%
echo.

REM Use the temporary .env file
copy .env .env.backup > nul
copy .env.temp .env > nul

REM Run the program
call npm start

REM Restore the original .env file
copy .env.backup .env > nul
del .env.backup
del .env.temp

echo Done!
goto :eof

:show_help
echo LinkedIn Connection Checker Runner
echo.
echo Usage: run.bat [options]
echo.
echo Options:
echo   -s, --spreadsheet ID   Google Spreadsheet ID
echo   -n, --sheet NAME       Sheet name (default: Sheet1)
echo   -d, --delay MSEC       Delay between profile checks in milliseconds (default: 3000)
echo   -h, --headless         Run in headless mode (no browser UI)
echo   -a, --ai PROVIDER      AI provider to use: 'anthropic' or 'openai' (default: anthropic)
echo   --help                 Show this help message
echo.
echo Example:
echo   run.bat -s 1GMMICr0fwmj1ghdLNq5wcGSyeeeStOYGw5Oo3rJDLwY -n Sheet1 -a openai
echo.
goto :eof 