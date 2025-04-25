import { Stagehand, Page, BrowserContext } from "@browserbasehq/stagehand";
import StagehandConfig from "./stagehand.config.js";
import chalk from "chalk";
import { Profile, ProfileStatus } from "./types.js";
import { GoogleSheetsClient } from "./google-sheets.js";
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { z } from "zod";
import https from 'https';
import http from 'http';

/**
 * LinkedIn Connection Status Checker
 * 
 * This script checks the status of LinkedIn connection requests
 * and updates the results in a Google Sheet.
 */

// Cookie file path for persisting login session
const COOKIE_FILE_PATH = path.join(process.cwd(), 'linkedin-cookies.json');

// Create a readline interface for prompting user
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify the question method
function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer);
    });
  });
}

/**
 * Validate API key using the respective service endpoints
 */
async function validateApiKey(type: 'google' | 'openai' | 'anthropic', apiKey: string): Promise<{valid: boolean, error?: string}> {
  if (!apiKey || apiKey.trim() === '') {
    return { valid: false, error: 'API key is empty' };
  }

  return new Promise((resolve) => {
    let options: http.RequestOptions;
    
    if (type === 'google') {
      // Test Google Sheets API
      options = {
        hostname: 'sheets.googleapis.com',
        path: `/v4/spreadsheets?key=${apiKey}`,
        method: 'GET'
      };
    } else if (type === 'openai') {
      // Test OpenAI API
      options = {
        hostname: 'api.openai.com',
        path: '/v1/models',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      };
    } else if (type === 'anthropic') {
      // Test Anthropic API - Updated to use a simpler endpoint
      options = {
        hostname: 'api.anthropic.com',
        path: '/v1/models',
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      };
    } else {
      resolve({ valid: false, error: 'Unknown API type' });
      return;
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        // Only collect the first few KB to avoid large responses
        if (responseData.length < 1024 * 3) {
          responseData += chunk;
        }
      });
      
      res.on('end', () => {
        // For Google: 400 might mean invalid project or key, 403 might mean valid key but no permission
        // For OpenAI/Anthropic: 401 means invalid key, 200 or 400 (invalid request but valid auth) are good
        const statusCode = res.statusCode || 500;
        
        if (type === 'google') {
          if (statusCode === 200) {
            resolve({ valid: true });
          } else if (statusCode === 403) {
            resolve({ valid: true, error: 'API key valid but missing permissions' });
          } else {
            resolve({ valid: false, error: `Google API error (${statusCode}): ${responseData}` });
          }
        } else if (type === 'openai') {
          if (statusCode === 200 || statusCode === 400) {
            resolve({ valid: true });
          } else {
            resolve({ valid: false, error: `OpenAI API error (${statusCode}): ${responseData}` });
          }
        } else if (type === 'anthropic') {
          // Anthropic will return 401 for invalid key, 200 for success
          if (statusCode === 200) {
            resolve({ valid: true });
          } else if (statusCode === 404 && responseData.includes('not_found_error') && responseData.includes('model:')) {
            // If we get a 404 specifically about model not found, the key might still be valid
            // But the model name is wrong - accept this as a valid key
            resolve({ valid: true, error: 'API key appears valid, but model name may need updating' });
          } else {
            resolve({ valid: false, error: `Anthropic API error (${statusCode}): ${responseData}` });
          }
        }
      });
    });
    
    req.on('error', (error) => {
      resolve({ valid: false, error: `Network error: ${error.message}` });
    });
    
    // No need to send body for a GET request
    if (type === 'anthropic' && options.method === 'POST') {
      req.write(JSON.stringify({
        model: "claude-3-sonnet-20240229",
        max_tokens: 1,
        messages: [{role: "user", content: "test"}]
      }));
    }
    
    // Set timeout
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ valid: false, error: 'Request timed out' });
    });
    
    req.end();
  });
}

/**
 * Validate Google Spreadsheet access
 */
async function validateSpreadsheetAccess(spreadsheetId: string, apiKey: string): Promise<{valid: boolean, error?: string}> {
  if (!spreadsheetId) {
    return { valid: false, error: 'Missing spreadsheet ID' };
  }
  
  // First check if we have a service account file
  const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    console.log(chalk.green('✅ Service account credentials found. Will use OAuth for authentication.'));
    return { valid: true };
  }
  
  // Otherwise validate using API key
  if (!apiKey) {
    return { valid: false, error: 'Missing API key and no service account credentials found' };
  }
  
  return new Promise((resolve) => {
    const options = {
      hostname: 'sheets.googleapis.com',
      path: `/v4/spreadsheets/${spreadsheetId}?key=${apiKey}`,
      method: 'GET'
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        if (responseData.length < 1024 * 3) {
          responseData += chunk;
        }
      });
      
      res.on('end', () => {
        const statusCode = res.statusCode || 500;
        
        if (statusCode === 200) {
          resolve({ 
            valid: true, 
            error: 'Note: API key can only be used for read access. For write access, set up a service account as described in the README.' 
          });
        } else if (statusCode === 403) {
          resolve({ valid: false, error: 'API key valid but missing permissions to access this spreadsheet' });
        } else if (statusCode === 404) {
          resolve({ valid: false, error: 'Spreadsheet not found. Check the ID and ensure it\'s shared properly.' });
        } else if (statusCode === 401) {
          resolve({ valid: false, error: 'Authentication failed. Invalid Google API key.' });
        } else {
          resolve({ valid: false, error: `Google Sheets API error (${statusCode}): ${responseData}` });
        }
      });
    });
    
    req.on('error', (error) => {
      resolve({ valid: false, error: `Network error: ${error.message}` });
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ valid: false, error: 'Request timed out' });
    });
    
    req.end();
  });
}

// Simplify the getSetupInfo function to follow the exact flow requested
async function getSetupInfo(): Promise<{provider: string, apiKey: string, spreadsheetId: string, sheetName: string}> {
  console.log(chalk.blue('=== LinkedIn Connection Checker Setup ==='));

  // Check if service account exists
  const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
  const hasServiceAccount = fs.existsSync(serviceAccountPath);
  
  if (hasServiceAccount) {
    console.log(chalk.green('✅ Found service-account.json - This will be used for OAuth authentication'));
    console.log(chalk.green('✅ Make sure you\'ve shared your sheet with the service account email'));
  } else {
    console.log(chalk.yellow('⚠️ No service-account.json found. Using API key authentication instead.'));
    console.log(chalk.yellow('⚠️ For write access without public sharing, follow instructions in service-account-setup.md'));
  }
  
  // 1. Choose AI provider
  let provider = '';
  let validProvider = false;
  
  while (!validProvider) {
    provider = await question(chalk.cyan('Select AI provider (openai/anthropic): '));
    provider = provider.toLowerCase().trim();
    
    if (provider === 'openai' || provider === 'anthropic') {
      validProvider = true;
    } else {
      console.log(chalk.red('❌ Error: Please enter either "openai" or "anthropic"'));
    }
  }
  
  // 2. Enter and validate AI API key
  let apiKey = '';
  let apiKeyValid = false;
  let attempts = 0;
  
  while (!apiKeyValid && attempts < 3) {
    apiKey = await question(chalk.cyan(`Enter your ${provider} API key: `));
    console.log(chalk.yellow('Validating API key...'));
    
    const validation = await validateApiKey(provider as 'openai' | 'anthropic', apiKey);
    if (validation.valid) {
      apiKeyValid = true;
      console.log(chalk.green('✅ API key validated successfully!'));
    } else {
      attempts++;
      console.log(chalk.red(`❌ Error: Invalid API key. ${validation.error}`));
      console.log(chalk.yellow(`Attempts remaining: ${3 - attempts}`));
      
      if (attempts >= 3) {
        console.log(chalk.yellow('⚠️ Proceeding with unvalidated API key after 3 failed attempts...'));
        break;
      }
    }
  }
  
  // 3. Enter Google Spreadsheet ID
  const spreadsheetId = await question(chalk.cyan('Enter your Google Spreadsheet ID: '));
  
  // 4. Enter Sheet Name
  const sheetName = await question(chalk.cyan('Enter your Sheet name (default: Sheet1): ')) || 'Sheet1';
  
  // Setup the Google API key as an environment variable
  // This is used for fallback if OAuth is not configured
  if (!hasServiceAccount) {
    console.log(chalk.yellow('⚠️ No service account found. Using temporary API key for Google Sheets.'));
    
    // Since we don't have a service account file, we'll use a temporary API key
    // For simplicity, we'll use the AI provider key as a placeholder
    // This won't work for writing unless the sheet is public, but it should work for reading
    process.env.GOOGLE_API_KEY = apiKey;
  }
  
  return { provider, apiKey, spreadsheetId, sheetName };
}

// Simplify the main function to just get profiles and update the sheet
async function main({
  page,
  context,
  stagehand,
  spreadsheetId,
  sheetName
}: {
  page: Page;
  context: BrowserContext;
  stagehand: Stagehand;
  spreadsheetId: string;
  sheetName: string;
}) {
  // Default sample profiles in case we can't access Google Sheets
  let profiles: Profile[] = [
    { url: "https://www.linkedin.com/in/williamhgates", row: 2 },
    { url: "https://www.linkedin.com/in/satyanadella", row: 3 },
    { url: "https://www.linkedin.com/in/sundarpichai", row: 4 },
  ];

  console.log(chalk.blue("🔍 LinkedIn Connection Checker"));
  
  // Create array to store all results
  const results: {url: string, row: number, status?: string}[] = [];
  
  // Try to fetch profiles from Google Sheets
  try {
    console.log(chalk.green("Fetching profiles from Google Sheets..."));
    
    const sheetsClient = new GoogleSheetsClient(
      spreadsheetId,
      sheetName
    );
    
    const fetchedProfiles = await sheetsClient.getProfiles();
    if (fetchedProfiles && fetchedProfiles.length > 0) {
      profiles = fetchedProfiles;
      console.log(chalk.green(`✅ Fetched ${profiles.length} profiles from Google Sheets`));
    }
  } catch (error) {
    console.log(chalk.yellow("⚠️ Could not fetch profiles from Google Sheets"));
    console.log(chalk.gray("Using sample profiles instead"));
  }
  
  // Log in to LinkedIn
  await loginToLinkedIn(page, context, stagehand);
  
  // Process each profile
  for (const profile of profiles) {
    try {
      await processProfile(page, profile, stagehand);
      
      // Add to results array
      results.push(profile);
      
      // Try to update Google Sheet
      if (profile.status) {
        try {
          const sheetsClient = new GoogleSheetsClient(
            spreadsheetId,
            sheetName
          );
          await sheetsClient.updateProfileStatus(profile.row, profile.status);
          console.log(chalk.green(`✅ Updated row ${profile.row} in Google Sheet with status: ${profile.status}`));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          if (errorMessage.includes('Login Required') || errorMessage.includes('insufficient permission')) {
            console.log(chalk.yellow(`⚠️ Your Google Sheet is not set to "Anyone with the link can edit"`));
            console.log(chalk.gray(`Would update row ${profile.row} with: ${profile.status}`));
          } else {
            console.log(chalk.red(`❌ Error updating Google Sheet: ${errorMessage}`));
          }
        }
      }
      
    } catch (error) {
      console.log(chalk.red(`❌ Error processing: ${profile.url}`));
    }
    
    // Add a delay between profile checks to avoid rate limiting
    console.log(chalk.gray("Waiting before next profile..."));
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  // Display summary of results
  console.log(chalk.blue("\n===== Results Summary ====="));
  
  if (results.length === 0) {
    console.log(chalk.yellow("No profiles were processed"));
  } else {
    for (const profile of results) {
      const statusColor = profile.status === ProfileStatus.ACCEPTED ? chalk.green : 
                       profile.status === ProfileStatus.PENDING ? chalk.yellow : chalk.gray;
      console.log(`${statusColor(`${profile.url}: ${profile.status || 'unknown'}`)} (Row ${profile.row})`);
    }
  }
  
  // Open the Google Sheet in the browser
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0`;
  console.log(chalk.blue(`\nYour Google Sheet: ${sheetUrl}`));
  console.log(chalk.gray("Opening sheet in your default browser..."));
  
  try {
    // Open the URL using the 'open' command for macOS, 'start' for Windows, or 'xdg-open' for Linux
    const command = process.platform === 'darwin' ? 'open' : 
                  process.platform === 'win32' ? 'start' : 'xdg-open';
    
    const { exec } = require('child_process');
    exec(`${command} "${sheetUrl}"`);
  } catch (error) {
    console.log(chalk.yellow(`Could not open browser automatically. Visit the URL manually.`));
  }
  
  console.log(chalk.blue("\n✨ Process Completed!"));
  
  return results;
}

/**
 * Login to LinkedIn
 */
async function loginToLinkedIn(page: Page, context: BrowserContext, stagehand: Stagehand) {
  console.log(chalk.blue("Attempting to log in to LinkedIn..."));

  // Try to load cookies if they exist
  let cookiesLoaded = false;
  try {
    if (fs.existsSync(COOKIE_FILE_PATH)) {
      console.log(chalk.blue("Found saved session cookies, attempting to use them..."));
      const cookiesStr = fs.readFileSync(COOKIE_FILE_PATH, 'utf8');
      const cookies = JSON.parse(cookiesStr);
      await context.addCookies(cookies);
      cookiesLoaded = true;
      
      // Navigate to LinkedIn homepage to test if cookies work
      await page.goto("https://www.linkedin.com/feed/");
      
      // Check if we're logged in
      const isLoggedIn = await page.evaluate(() => {
        return !document.body.textContent?.includes('Sign in') && 
               !document.body.textContent?.includes('Log in') &&
               !window.location.href.includes('/login');
      });
      
      if (isLoggedIn) {
        console.log(chalk.green("✅ Successfully logged in using saved cookies"));
        return;
      } else {
        console.log(chalk.yellow("⚠️ Saved cookies have expired, manual login required"));
      }
    }
  } catch (error) {
    console.log(chalk.yellow("⚠️ Error loading cookies, manual login required"));
  }
  
  // If cookies failed or don't exist, proceed with manual login
  if (!cookiesLoaded) {
    // Navigate to LinkedIn login page
    await page.goto("https://www.linkedin.com/login");
    
    console.log(chalk.blue("Please enter your LinkedIn credentials in the browser window..."));
    console.log(chalk.yellow("NOTE: Manual login required. The automation will wait for you to log in."));
    
    // Wait for navigation to occur after login
    try {
      // Wait for either feed or homepage after login
      await page.waitForNavigation({ 
        timeout: 120000, // 2 minute timeout for manual login
        url: url => url.toString().includes('feed') || url.toString().includes('mynetwork')
      });
      
      console.log(chalk.green("✅ Successfully logged in to LinkedIn"));
      
      // Save cookies for future use
      const cookies = await context.cookies();
      fs.writeFileSync(COOKIE_FILE_PATH, JSON.stringify(cookies, null, 2));
      console.log(chalk.green("✅ Saved session cookies for future use"));
    } catch (error) {
      console.log(chalk.red("❌ Login timeout or error. Please try again."));
      throw new Error("LinkedIn login failed. Timeout waiting for navigation after login.");
    }
  }
}

/**
 * Process a single LinkedIn profile
 */
async function processProfile(page: Page, profile: Profile, stagehand: Stagehand) {
  console.log(chalk.blue(`\nChecking profile: ${profile.url}`));

  // Navigate to the profile
  await page.goto(profile.url, { timeout: 30000 });

  // Check if we've been rate limited
  const isRateLimited = await page.evaluate(() => {
    return document.body.textContent?.includes('unusual amount of traffic') || false;
  });

  if (isRateLimited) {
    console.log(chalk.red("⚠️ LinkedIn is rate limiting requests. Try again later."));
    throw new Error("LinkedIn is rate limiting the requests. Try again later.");
  }
  
  // Determine connection status
  const connectionStatus = await determineConnectionStatus(page);
  
  // Update profile object with status
  profile.status = connectionStatus.status;
  
  const statusColor = profile.status === ProfileStatus.ACCEPTED ? chalk.green : 
                     profile.status === ProfileStatus.PENDING ? chalk.yellow : chalk.gray;
  
  console.log(statusColor(`Profile status: ${profile.status}`));
  console.log(chalk.gray(`Confidence: ${connectionStatus.confidence}`));
  console.log(chalk.gray(`Reasoning: ${connectionStatus.reasoning}`));
}

/**
 * Determine the connection status based on page content
 */
async function determineConnectionStatus(page: Page) {
  // Simple method to check for specific elements that indicate connection status
  const evaluation = await page.evaluate(() => {
    const results = {
      hasConnectButton: false,
      hasPendingButton: false,
      hasMessageButton: false,
      connectionDegree: ''
    };
    
    // Check for buttons by their text content
    const buttons = document.querySelectorAll('button');
    for (const button of buttons) {
      const text = button.textContent || '';
      const ariaLabel = button.getAttribute('aria-label') || '';
      
      if (text.includes('Connect') || ariaLabel.includes('Connect')) {
        results.hasConnectButton = true;
      }
      if (text.includes('Pending') || ariaLabel.includes('Pending')) {
        results.hasPendingButton = true;
      }
      if (text.includes('Message') || ariaLabel.includes('Message')) {
        results.hasMessageButton = true;
      }
    }
    
    // Look for connection degree text (1st, 2nd, 3rd)
    const degreeElements = document.querySelectorAll('.distance-badge, .pv-top-card__distance-badge, .dist-value');
    for (const elem of degreeElements) {
      const text = elem.textContent || '';
      if (text.includes('1st') || text.includes('2nd') || text.includes('3rd')) {
        results.connectionDegree = text.trim();
        break;
      }
    }
    
    // Check for specific connection status indicators in the HTML
    const htmlString = document.documentElement.outerHTML;
    const isPending = htmlString.includes('"connectionStatus":"PENDING"') || 
                      htmlString.includes('invitationPending');
    
    const isConnected = htmlString.includes('"connectionStatus":"CONNECTED"') || 
                        htmlString.includes('connection-degree-1');
    
    return {
      ...results,
      isPendingInHtml: isPending,
      isConnectedInHtml: isConnected
    };
  });
  
  let status = ProfileStatus.UNKNOWN;
  let reasoning = "Could not determine connection status with confidence";
  let confidence = 0.5;
  
  // Decision logic based on elements found on the page
  if (evaluation.isPendingInHtml || evaluation.hasPendingButton) {
    status = ProfileStatus.PENDING;
    reasoning = "Found 'Pending' button or pending status in profile data";
    confidence = 0.95;
  } else if (evaluation.isConnectedInHtml || (evaluation.hasMessageButton && !evaluation.hasConnectButton) || 
            evaluation.connectionDegree.includes('1st')) {
    status = ProfileStatus.ACCEPTED;
    reasoning = "Profile is a 1st degree connection with message button";
    confidence = 0.95;
  } else if (evaluation.hasConnectButton || evaluation.connectionDegree.includes('2nd') || 
            evaluation.connectionDegree.includes('3rd')) {
    status = ProfileStatus.NOT_CONNECTED;
    reasoning = "Found 'Connect' button or 2nd/3rd degree connection";
    confidence = 0.9;
  }
  
  return {
    status,
    confidence,
    reasoning
  };
}

// Function to export results to CSV
function exportResultsToCSV(results: Array<{url: string, status: string}>) {
  const csvContent = "LinkedIn URL,Connection Status\n" + 
    results.map(item => `${item.url},${item.status}`).join('\n');
  
  const filename = `linkedin_results_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  fs.writeFileSync(filename, csvContent);
  console.log(chalk.green(`✅ Results exported to CSV: ${filename}`));
  console.log(chalk.yellow(`You can open this file in Excel or Google Sheets`));
}

// Update the run function for the simplified flow
async function run() {
  try {
    // Get setup information from user first - before any other initialization
    const { provider, apiKey, spreadsheetId, sheetName } = await getSetupInfo();
    
    // Set environment variables for the Stagehand config
    process.env.AI_PROVIDER = provider;
    process.env.SPREADSHEET_ID = spreadsheetId;
    
    // Set the appropriate API key
    if (provider === 'openai') {
      process.env.OPENAI_API_KEY = apiKey;
      console.log(chalk.green("Using OpenAI as the AI provider"));
    } else {
      process.env.ANTHROPIC_API_KEY = apiKey;
      console.log(chalk.green("Using Anthropic Claude as the AI provider"));
    }
    
    // Initialize Stagehand with the updated config
  const stagehand = new Stagehand({
    ...StagehandConfig,
  });
  await stagehand.init();

  const page = stagehand.page;
  const context = stagehand.context;
    
    // Execute the main process
  await main({
    page,
    context,
    stagehand,
      spreadsheetId,
      sheetName
  });
    
  await stagehand.close();
    console.log(chalk.green(`\n✅ LinkedIn connection status checking complete!\n`));
    
    // Close the readline interface
    rl.close();
  } catch (error) {
    console.error(chalk.red("Error running LinkedIn Connection Checker:"));
    console.error(error);
    // Close the readline interface on error
    rl.close();
    process.exit(1);
  }
}

run();
