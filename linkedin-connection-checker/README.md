# LinkedIn Connection Checker

This tool checks the connection status of LinkedIn profiles from a Google Sheet and provides the results.

## Quick Start

### 1. Install & Set Up

```bash
git clone [repository-url]
cd linkedin-connection-checker
npm install
```

### 2. Prepare Your Google Sheet

1. Create a Google Sheet with LinkedIn profile URLs in column A (starting from A2)
2. Add headers in row 1 (e.g., "Profile URL" in A1, "Status" in B1)

### 3. Run the Program

```bash
npm start
```

The program will guide you through a simple setup process where you'll need:
- Your choice of AI provider (OpenAI or Anthropic) and API key
- Your Google Spreadsheet ID (from the sheet URL)
- Your Google API key
- Your choice of how to export results (directly to sheet or to CSV)

## Features

- ✅ Automatically checks LinkedIn connection status (accepted, pending, not connected)
- ✅ Two simple export options:
  - Update Google Sheet directly (requires public sharing)
  - Export to CSV file (can be opened in Excel or imported to Google Sheets)
- ✅ Saves cookies to avoid repeated logins

## Updating Google Sheets Directly

If you choose to update your Google Sheet directly, you'll need to:
1. Go to your Google Sheet
2. Click "Share" in the top-right corner
3. Change access to "Anyone with the link" 
4. Set permission to "Editor"
5. Click "Done"

This is required because the application uses an API key authentication method which can only write to publicly editable sheets.

## Using CSV Export Instead

If you prefer not to make your sheet public, choose the CSV export option when prompted. This will:
1. Read profile URLs from your Google Sheet
2. Check all connection statuses
3. Save results to a CSV file on your computer
4. Let you manually upload or copy the results back to your sheet

## Troubleshooting

- **Login Issues**: Delete the `linkedin-cookies.json` file to force a new login
- **Google Sheets Errors**: Make sure your sheet is publicly editable if using direct updates
- **API Key Errors**: Double-check your Google API key has Google Sheets API enabled
- **Rate Limiting**: The tool automatically adds delays between profile checks
