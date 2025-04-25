import { google } from 'googleapis';
import express from 'express';
import open from 'open';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import readline from 'readline';
import inquirer from 'inquirer';

// File to store credentials
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
const TOKEN_PATH = path.join(process.cwd(), 'token.json');

/**
 * Setup OAuth2 for Google Sheets with proper scopes
 */
async function setupOAuth2() {
  console.log(chalk.greenBright.bold('\n===== Google Sheets OAuth2 Setup =====\n'));
  console.log(chalk.white('This setup will guide you through setting up OAuth2 for Google Sheets access.'));
  console.log(chalk.white('You\'ll need to:'));
  console.log(chalk.white('  1. Create a project in Google Cloud Console'));
  console.log(chalk.white('  2. Enable the Google Sheets API'));
  console.log(chalk.white('  3. Create OAuth 2.0 credentials'));
  console.log(chalk.white('  4. Download and provide the credentials JSON file\n'));

  try {
    // Check if credentials already exist
    let credentials;
    try {
      const credentialsContent = await fs.readFile(CREDENTIALS_PATH, 'utf8');
      credentials = JSON.parse(credentialsContent);
      console.log(chalk.green('Found existing credentials.json file'));
    } catch (error) {
      // Need to get credentials from the user
      console.log(chalk.yellow('No credentials.json file found.'));
      
      console.log(chalk.white('\nTo create OAuth credentials:'));
      console.log(chalk.white('1. Go to https://console.cloud.google.com/'));
      console.log(chalk.white('2. Create a new project or select an existing one'));
      console.log(chalk.white('3. Enable the Google Sheets API'));
      console.log(chalk.white('4. Create OAuth 2.0 credentials (APIs & Services > Credentials > Create Credentials > OAuth Client ID)'));
      console.log(chalk.white('5. Set the application type to "Web application"'));
      console.log(chalk.white('6. Add "http://localhost:3000/oauth2callback" as an authorized redirect URI'));
      console.log(chalk.white('7. Download the JSON file\n'));
      
      const { credentialsPath } = await inquirer.prompt([
        {
          type: 'input',
          name: 'credentialsPath',
          message: 'Enter the path to your downloaded credentials JSON file:',
          validate: async (input) => {
            try {
              await fs.access(input);
              return true;
            } catch (err) {
              return 'File does not exist or is not accessible';
            }
          }
        }
      ]);
      
      // Read and validate the credentials file
      const credentialsContent = await fs.readFile(credentialsPath, 'utf8');
      credentials = JSON.parse(credentialsContent);
      
      // Validate it has the needed structure
      if (!credentials.installed && !credentials.web) {
        throw new Error('Invalid credentials file format. Make sure you downloaded OAuth 2.0 client credentials.');
      }
      
      // Copy the file to credentials.json
      await fs.writeFile(CREDENTIALS_PATH, credentialsContent);
      console.log(chalk.green('Credentials file saved successfully'));
    }

    // Create OAuth client
    const clientCredentials = credentials.installed || credentials.web;
    const oauth2Client = new google.auth.OAuth2(
      clientCredentials.client_id,
      clientCredentials.client_secret,
      'http://localhost:3000/oauth2callback'
    );

    // Check if we already have a token
    let token;
    try {
      const tokenContent = await fs.readFile(TOKEN_PATH, 'utf8');
      token = JSON.parse(tokenContent);
      console.log(chalk.green('Found existing token.json file'));
      
      // Set credentials and check if they're valid
      oauth2Client.setCredentials(token);
      
      // Test the token with a simple API call
      const sheets = google.sheets({version: 'v4', auth: oauth2Client});
      await sheets.spreadsheets.get({
        spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms' // Example spreadsheet ID
      });
      
      console.log(chalk.green('Token is valid and working!'));
      
      const { shouldRegenerateToken } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldRegenerateToken',
          message: 'Would you like to regenerate the token anyway?',
          default: false
        }
      ]);
      
      if (!shouldRegenerateToken) {
        console.log(chalk.green('Using existing token.'));
        return;
      }
    } catch (error) {
      console.log(chalk.yellow('No valid token found or token is expired. Will generate a new one.'));
    }

    // Generate a new token through browser authentication
    await getNewToken(oauth2Client);
    
  } catch (error) {
    console.error(chalk.red('Error during OAuth setup:'), error);
    process.exit(1);
  }
}

/**
 * Get a new token by opening the browser for authentication
 */
async function getNewToken(oauth2Client) {
  return new Promise((resolve, reject) => {
    // Start a local server to receive the callback
    const app = express();
    let server = null;

    // Define the authorization URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/spreadsheets'],
      prompt: 'consent' // Force to always get a refresh token
    });

    // Handle the OAuth callback
    app.get('/oauth2callback', async (req, res) => {
      try {
        const code = req.query.code;
        if (!code) {
          res.send('No authorization code was received.');
          return reject(new Error('No authorization code received'));
        }

        // Exchange the code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Save the token
        await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens));
        console.log(chalk.green('Token saved successfully'));

        // Send success page
        res.send(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #4CAF50;">Authentication Successful</h1>
              <p>You may now close this window and return to the terminal.</p>
            </body>
          </html>
        `);

        // Close the server
        setTimeout(() => {
          server.close();
          resolve(oauth2Client);
        }, 2000);
      } catch (error) {
        console.error(chalk.red('Error getting token:'), error);
        res.send(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #f44336;">Authentication Failed</h1>
              <p>An error occurred: ${error.message}</p>
              <p>Please close this window and try again.</p>
            </body>
          </html>
        `);
        reject(error);
      }
    });

    // Start the server
    server = app.listen(3000, () => {
      console.log(chalk.blue('\nAuthorize this app by visiting this URL:'));
      console.log(chalk.blue.underline(authUrl));
      console.log(chalk.white('\nA browser window should open automatically. If it doesn\'t, please copy and paste the URL into your browser.'));
      
      // Open the browser
      open(authUrl).catch(error => {
        console.log(chalk.yellow('Could not open browser automatically. Please open the URL manually.'));
      });
    });
  });
}

// Run setup if called directly
if (require.main === module) {
  setupOAuth2().then(() => {
    console.log(chalk.greenBright.bold('\nOAuth2 setup complete!'));
    console.log(chalk.white('You can now run the LinkedIn Connection Checker with:'));
    console.log(chalk.whiteBright('  npm start'));
    process.exit(0);
  }).catch(error => {
    console.error(chalk.red('OAuth2 setup failed:'), error);
    process.exit(1);
  });
}

export { setupOAuth2 }; 