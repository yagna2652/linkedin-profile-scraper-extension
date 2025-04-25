async function runInteractiveSetup() {
  try {
    console.log(chalk.greenBright.bold('\n===== LinkedIn Connection Checker Setup =====\n'));
    console.log(chalk.white('This setup will guide you through configuring the LinkedIn Connection Checker.'));
    console.log(chalk.white('You\'ll need:'));
    console.log(chalk.white('  1. An AI provider API key (Anthropic or OpenAI)'));
    console.log(chalk.white('  2. A Google Sheets spreadsheet ID'));
    console.log(chalk.white('  3. Google authentication credentials (Service Account or API Key)\n'));

    // ... existing code ...

    // Google Sheets setup
    console.log(chalk.blueBright.bold('\nGoogle Sheets Integration Setup'));
    
    const { spreadsheetId } = await inquirer.prompt([
      {
        type: 'input',
        name: 'spreadsheetId',
        message: 'Enter your Google Spreadsheet ID:',
        validate: (input) => !!input || 'Spreadsheet ID is required'
      }
    ]);

    const { sheetName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'sheetName',
        message: 'Enter the name of the sheet where your LinkedIn profiles are stored:',
        default: 'Sheet1'
      }
    ]);

    // Google authentication setup
    console.log(chalk.blueBright('\nGoogle Authentication Setup'));
    console.log(chalk.white('You have two options for authenticating with Google Sheets:'));
    console.log(chalk.white('1. Service Account (recommended) - Allows writing to the sheet'));
    console.log(chalk.white('2. API Key (limited) - Read-only access unless the sheet is publicly editable\n'));

    const { authMethod } = await inquirer.prompt([
      {
        type: 'list',
        name: 'authMethod',
        message: 'How would you like to authenticate with Google Sheets?',
        choices: [
          { name: 'Service Account (recommended)', value: 'serviceAccount' },
          { name: 'API Key (limited permissions)', value: 'apiKey' }
        ]
      }
    ]);

    if (authMethod === 'serviceAccount') {
      console.log(chalk.yellow('\nTo use a Service Account, follow these steps:'));
      console.log('1. Go to https://console.cloud.google.com/');
      console.log('2. Create a new project or select an existing one');
      console.log('3. Enable the Google Sheets API');
      console.log('4. Create a service account (APIs & Services > Credentials > Create Credentials > Service Account)');
      console.log('5. Create a key for the service account (JSON format)');
      console.log('6. Download the JSON file and save it as "service-account.json" in this directory');
      console.log('7. Share your Google Sheet with the service account email (it looks like: service-account@project-id.iam.gserviceaccount.com)\n');

      const { hasServiceAccount } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'hasServiceAccount',
          message: 'Have you created a service account and downloaded the JSON key file?'
        }
      ]);

      if (hasServiceAccount) {
        const { serviceAccountPath } = await inquirer.prompt([
          {
            type: 'input',
            name: 'serviceAccountPath',
            message: 'Enter the path to your service account JSON file:',
            default: './service-account.json'
          }
        ]);

        try {
          // Read and validate the service account file
          const saFileContent = await fs.readFile(serviceAccountPath, 'utf8');
          const saData = JSON.parse(saFileContent);
          
          if (!saData.client_email || !saData.private_key) {
            console.log(chalk.red('The service account file appears to be invalid. It must contain client_email and private_key.'));
            // Continue with API key as a fallback
          } else {
            // Copy the file to the service-account.json in the current directory
            if (serviceAccountPath !== './service-account.json' && serviceAccountPath !== 'service-account.json') {
              await fs.copyFile(serviceAccountPath, './service-account.json');
              console.log(chalk.green('Service account file copied to service-account.json'));
            }

            console.log(chalk.green('\nService account configured successfully!'));
            console.log(chalk.yellow(`Important: Make sure to share your Google Sheet with the service account email: ${saData.client_email}`));
          }
        } catch (error) {
          console.log(chalk.red(`Error reading service account file: ${error instanceof Error ? error.message : String(error)}`));
          console.log(chalk.yellow('Continuing with API key authentication as a fallback...'));
        }
      } else {
        console.log(chalk.yellow('\nContinuing setup without a service account.'));
        console.log(chalk.yellow('You can add a service account later by placing the JSON file in this directory.'));
      }
    }

    // Ask for API key regardless, as a fallback
    const { googleApiKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'googleApiKey',
        message: 'Enter your Google API Key (optional if using service account):',
        mask: '*'
      }
    ]);

    // ... existing code ...

    // Update env variables
    const envUpdates = {
      SPREADSHEET_ID: spreadsheetId,
      SHEET_NAME: sheetName
    };

    if (googleApiKey) {
      envUpdates.GOOGLE_API_KEY = googleApiKey;
    }

    // ... existing code ...

    console.log(chalk.greenBright.bold('\nSetup complete!'));
    console.log(chalk.white('You can now run the LinkedIn Connection Checker with:'));
    console.log(chalk.whiteBright('  npm start'));

    if (authMethod === 'serviceAccount') {
      console.log(chalk.yellow('\nReminder: If you\'re using a service account, make sure you\'ve shared your'));
      console.log(chalk.yellow('Google Sheet with the service account email address.'));
    } else {
      console.log(chalk.yellow('\nReminder: With API key authentication, your Google Sheet must be publicly'));
      console.log(chalk.yellow('shared with "Anyone with the link can edit" for write operations to work.'));
    }

  } catch (error) {
    console.error(chalk.red('Error during setup:'), error);
    process.exit(1);
  }
} 