# Setting Up OAuth for Google Sheets

This guide will help you set up OAuth authentication to allow the LinkedIn Connection Checker to write to your Google Sheets without requiring public sharing permissions.

## Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Create Project" or select an existing project
3. Take note of your project ID

## Step 2: Enable the Google Sheets API

1. In your Google Cloud project, go to "APIs & Services" > "Library"
2. Search for "Google Sheets API" and enable it

## Step 3: Create a Service Account

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Enter a name for your service account (e.g., "LinkedIn Connection Checker")
4. Click "Create and Continue"
5. For "Grant this service account access to project", select "Editor" role
6. Click "Done"

## Step 4: Create a Service Account Key

1. From the credentials list, click on your newly created service account
2. Go to the "Keys" tab
3. Click "Add Key" > "Create new key"
4. Select "JSON" format and click "Create"
5. The key file will download automatically
6. Rename this file to `service-account.json` and place it in the `linkedin-connection-checker` directory

## Step 5: Share Your Google Sheet

1. Copy the email address of your service account - it will look like:
   `service-account-name@project-id.iam.gserviceaccount.com`
2. Open your Google Sheet
3. Click "Share" in the top-right corner
4. Paste the service account email and set permission to "Editor"
5. Click "Share"

## Step 6: Run the Program

1. Make sure the `service-account.json` file is in the same directory as the program
2. Run the program with `npm start`
3. The program will automatically detect the service account file and use OAuth authentication

## Sample Service Account JSON Format

Your service-account.json file should look similar to this (with your own values):

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "your-private-key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\nYour private key content...\n-----END PRIVATE KEY-----\n",
  "client_email": "your-service-account@your-project-id.iam.gserviceaccount.com",
  "client_id": "your-client-id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-project-id.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
}
```

## Troubleshooting

- **Error: "insufficient permission"**: Make sure you've shared your Google Sheet with the service account email address and given it Editor access.
- **Error: "invalid_grant"**: The service account credentials may be corrupt or expired. Create a new key.
- **Sheet Not Found**: Verify the spreadsheet ID and sheet name are correct. 