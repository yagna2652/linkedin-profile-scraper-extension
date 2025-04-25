#!/bin/bash
# LinkedIn Connection Checker Runner Script

# Function to display help message
show_help() {
  echo "LinkedIn Connection Checker Runner"
  echo ""
  echo "Usage: ./run.sh [options]"
  echo ""
  echo "Options:"
  echo "  -s, --spreadsheet ID   Google Spreadsheet ID"
  echo "  -n, --sheet NAME       Sheet name (default: Sheet1)"
  echo "  -d, --delay MSEC       Delay between profile checks in milliseconds (default: 3000)"
  echo "  -h, --headless         Run in headless mode (no browser UI)"
  echo "  -a, --ai PROVIDER      AI provider to use: 'anthropic' or 'openai' (default: anthropic)"
  echo "  --help                 Show this help message"
  echo ""
  echo "Example:"
  echo "  ./run.sh -s 1GMMICr0fwmj1ghdLNq5wcGSyeeeStOYGw5Oo3rJDLwY -n Sheet1 -a openai"
  echo ""
}

# Default values
SHEET_NAME="Sheet1"
DELAY=3000
HEADLESS=false
AI_PROVIDER="anthropic"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -s|--spreadsheet)
      SPREADSHEET_ID="$2"
      shift 2
      ;;
    -n|--sheet)
      SHEET_NAME="$2"
      shift 2
      ;;
    -d|--delay)
      DELAY="$2"
      shift 2
      ;;
    -h|--headless)
      HEADLESS=true
      shift
      ;;
    -a|--ai)
      AI_PROVIDER="$2"
      shift 2
      ;;
    --help)
      show_help
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

# Check if spreadsheet ID is provided
if [ -z "$SPREADSHEET_ID" ]; then
  echo "Error: Spreadsheet ID is required"
  show_help
  exit 1
fi

# Validate AI provider
if [[ "$AI_PROVIDER" != "anthropic" && "$AI_PROVIDER" != "openai" ]]; then
  echo "Error: AI provider must be 'anthropic' or 'openai'"
  show_help
  exit 1
fi

# Create temporary .env file with provided values
cat > .env.temp << EOL
# LinkedIn Connection Checker Environment Configuration
BROWSERBASE_PROJECT_ID=c9488675-4c8f-468a-b113-ffaf27782bab

# Google Sheets Configuration
SPREADSHEET_ID=$SPREADSHEET_ID
SHEET_NAME=$SHEET_NAME

# Google API Key (from existing .env file)
GOOGLE_API_KEY=$(grep GOOGLE_API_KEY .env | cut -d= -f2)

# AI Provider configuration
AI_PROVIDER=$AI_PROVIDER

# API Keys from existing .env file
ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY .env | cut -d= -f2)
OPENAI_API_KEY=$(grep OPENAI_API_KEY .env | cut -d= -f2)

# Advanced Settings
PROFILE_CHECK_DELAY=$DELAY
HEADLESS_BROWSER=$HEADLESS
EOL

# Run the program with the temporary .env file
echo "Running LinkedIn Connection Checker with:"
echo "- Spreadsheet ID: $SPREADSHEET_ID"
echo "- Sheet Name: $SHEET_NAME"
echo "- Delay: $DELAY ms"
echo "- Headless: $HEADLESS"
echo "- AI Provider: $AI_PROVIDER"
echo ""

# Use the temporary .env file
mv .env .env.backup
mv .env.temp .env

# Run the program
npm start

# Restore the original .env file
mv .env.backup .env

echo "Done!" 