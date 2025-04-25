import { google, sheets_v4 } from 'googleapis';
import { ProfileStatus, Profile } from './types.js';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

/**
 * Google Sheets integration for LinkedIn connection checker
 */

// Column indices for the spreadsheet (0-based)
const COLUMNS = {
  PROFILE_URL: 0,  // Column A
  STATUS: 1,       // Column B
};

/**
 * Google Sheets Client for fetching and updating LinkedIn profiles
 */
export class GoogleSheetsClient {
  private sheets: sheets_v4.Sheets;
  private spreadsheetId: string;
  private sheetName: string;
  private initialized: boolean = false;
  private maxRetries: number = 3;

  constructor(spreadsheetId: string, sheetName: string = 'Sheet1') {
    this.spreadsheetId = spreadsheetId;
    this.sheetName = sheetName;
    this.sheets = this.initializeClient();
  }

  private initializeClient(): sheets_v4.Sheets {
    try {
      // Check if service account file exists
      const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
      
      let auth;
      
      if (fs.existsSync(serviceAccountPath)) {
        console.log(chalk.green('Using service account for Google Sheets authentication'));
        // Use service account if available
        const credentials = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        
        auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
      } else {
        console.log(chalk.yellow('No service account found. Using API key for Google Sheets (read-only unless sheet is public)'));
        // Fallback to API key
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
          throw new Error('No Google API key found in environment variables');
        }
        auth = apiKey;
      }
      
      return google.sheets({ version: 'v4', auth });
    } catch (error) {
      console.error(chalk.red('Error initializing Google Sheets client:'), error);
      throw error;
    }
  }

  async init(): Promise<void> {
    try {
      // Try to access the spreadsheet to verify credentials
      await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });
      
      this.initialized = true;
      console.log(chalk.green(`Successfully initialized Google Sheets client for spreadsheet ID: ${this.spreadsheetId}`));
    } catch (error) {
      console.error(chalk.red('Error initializing Google Sheets client:'), error);
      
      // Check if the error is due to permissions
      if (error.message?.includes('permission') || error.code === 403) {
        console.log(chalk.yellow('This appears to be a permissions error.'));
        console.log(chalk.yellow('If you\'re using a service account, make sure you\'ve shared your sheet with the service account email.'));
        console.log(chalk.yellow('If you\'re using an API key, make sure your sheet is shared publicly.'));
      }
      
      throw error;
    }
  }

  async getProfileUrls(): Promise<string[]> {
    if (!this.initialized) {
      throw new Error('Google Sheets client not initialized. Call init() first.');
    }

    try {
      console.log(chalk.blue(`Fetching LinkedIn profile URLs from sheet: ${this.sheetName}`));
      
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A2:A`,
      });

      const rows = response.data.values;
      
      if (!rows || rows.length === 0) {
        console.log(chalk.yellow('No data found in sheet.'));
        return [];
      }

      // Filter out empty rows and normalize URLs
      const urls = rows
        .filter(row => row[0] && row[0].trim() !== '')
        .map(row => this.normalizeLinkedInUrl(row[0]));

      console.log(chalk.green(`Found ${urls.length} LinkedIn profile URLs`));
      return urls;
    } catch (error) {
      console.error(chalk.red('Error fetching LinkedIn profile URLs:'), error);
      throw error;
    }
  }

  /**
   * Get profiles from the spreadsheet with row numbers
   */
  async getProfiles(): Promise<Profile[]> {
    if (!this.initialized) {
      await this.init();
    }

    try {
      console.log(chalk.blue(`Fetching LinkedIn profiles from sheet: ${this.sheetName}`));
      
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A2:A`,
      });

      const rows = response.data.values;
      
      if (!rows || rows.length === 0) {
        console.log(chalk.yellow('No data found in sheet.'));
        return [];
      }

      // Create profile objects with row numbers
      const profiles = rows
        .map((row, index) => {
          if (!row[0] || row[0].trim() === '') return null;
          return {
            url: this.normalizeLinkedInUrl(row[0]),
            row: index + 2  // +2 because spreadsheet is 1-indexed and we start from row 2
          };
        })
        .filter(profile => profile !== null);

      console.log(chalk.green(`Found ${profiles.length} LinkedIn profiles`));
      return profiles;
    } catch (error: any) {
      console.error(chalk.red('Error fetching LinkedIn profiles:'), error);
      throw error;
    }
  }

  /**
   * Update the status of a profile in the spreadsheet by row number
   */
  async updateProfileStatus(rowNumber: number, status: string, confidence: number = 0.9): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }

    try {
      console.log(chalk.blue(`Updating status in row ${rowNumber} to: ${status} (confidence: ${confidence})`));

      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${this.sheetName}!B${rowNumber}:C${rowNumber}`,
            valueInputOption: 'RAW',
            requestBody: {
              values: [[status, confidence.toString()]],
            },
          });
          
          console.log(chalk.green(`Successfully updated status in row ${rowNumber}`));
          return;
        } catch (error: any) {
          if (attempt < this.maxRetries) {
            const delay = attempt * 1000; // Increase delay with each retry
            console.log(chalk.yellow(`Error updating status for row ${rowNumber}, retrying in ${delay/1000}s... (Attempt ${attempt}/${this.maxRetries})`));
            console.log(chalk.gray(`Error details: ${error.message}`));
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            throw error; // Rethrow after all retries fail
          }
        }
      }
    } catch (error: any) {
      console.error(chalk.red(`Error updating status for row ${rowNumber}:`), error);
      
      if (error.message?.includes('permission') || error.code === 403) {
        console.log(chalk.yellow('This appears to be a permissions error.'));
        console.log(chalk.yellow('Make sure you\'ve shared your sheet with the service account email.'));
      }
      
      throw error;
    }
  }

  private async findRowIndexByProfileUrl(profileUrl: string): Promise<number> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:A`,
      });

      const rows = response.data.values;
      if (!rows) return -1;

      // Find the row index (0-based) where the URL matches
      return rows.findIndex(row => {
        if (!row[0]) return false;
        return this.normalizeLinkedInUrl(row[0]) === this.normalizeLinkedInUrl(profileUrl);
      });
    } catch (error) {
      console.error(chalk.red(`Error finding row for ${profileUrl}:`), error);
      throw error;
    }
  }

  /**
   * Normalize a LinkedIn profile URL to ensure it's in a consistent format
   */
  private normalizeLinkedInUrl(url: string): string {
    if (!url) return '';
    
    // Check if it's a LinkedIn URL
    if (!url.includes('linkedin.com')) {
      console.log(chalk.yellow(`Warning: ${url} doesn't appear to be a LinkedIn URL`));
      return url;
    }
    
    // Remove query parameters and trailing slashes
    let normalizedUrl = url.split('?')[0].replace(/\/$/, '');
    
    // Ensure the URL has /in/ for profiles
    if (!normalizedUrl.includes('/in/')) {
      if (normalizedUrl.endsWith('linkedin.com')) {
        console.log(chalk.red(`Error: ${url} is not a profile URL`));
        return url;
      }
      
      // Try to fix URLs without /in/
      normalizedUrl = normalizedUrl.replace('linkedin.com/', 'linkedin.com/in/');
    }
    
    return normalizedUrl;
  }

  /**
   * Update status by profile URL
   * This is a compatibility method that calls updateProfileStatus
   */
  async updateStatus(profileUrl: string, status: string, confidence: number, rowIndex?: number): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }

    try {
      // If rowIndex is not provided, find the row with this profile URL
      if (rowIndex === undefined) {
        rowIndex = await this.findRowIndexByProfileUrl(profileUrl);
        if (rowIndex === -1) {
          throw new Error(`Could not find profile URL ${profileUrl} in the sheet`);
        }
      }

      // Rows are 1-indexed in sheets, and we have a header row, so we add 1
      const targetRow = rowIndex + 1;
      
      console.log(chalk.blue(`Updating status for ${profileUrl} in row ${targetRow}: ${status} (confidence: ${confidence})`));
      
      // Call the new method
      return this.updateProfileStatus(targetRow, status, confidence);
    } catch (error: any) {
      console.error(chalk.red(`Error updating status for ${profileUrl}:`), error);
      throw error;
    }
  }
}

/**
 * Setup OAuth2 for Google Sheets
 * This is a more secure approach for production use
 */
export async function setupOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  // Generate a URL to request access from the user
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  console.log('Authorize this app by visiting this URL:', authUrl);
  
  // In a real application, you would handle the OAuth callback
  // and store the resulting tokens securely
  
  return oauth2Client;
} 