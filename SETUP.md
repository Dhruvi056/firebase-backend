# Setup Instructions

## Step 1: Create `.env` file

Create a file named `.env` in the root directory of your project with the following content:

```env
# Firebase Client SDK Configuration (for React app)
REACT_APP_FIREBASE_APIKEY=your-api-key-here
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_SENDER=your-sender-id
REACT_APP_FIREBASE_APPID=your-app-id
REACT_APP_FIREBASE_MEASUREMENT_ID=your-measurement-id

# Firebase Admin SDK Configuration (for API routes - REQUIRED)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----"

# Optional: Base URL
REACT_APP_BASE_URL=http://localhost:3000
```

## Step 2: Get Firebase Credentials

### For React App (Client SDK):
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** (gear icon) → **General** tab
4. Scroll down to **Your apps** section
5. Copy the values from your web app config

### For API Routes (Admin SDK):
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** → **Service Accounts** tab
4. Click **Generate new private key**
5. A JSON file will download
6. Open the JSON file and copy:
   - `project_id` → Use for `FIREBASE_PROJECT_ID`
   - `client_email` → Use for `FIREBASE_CLIENT_EMAIL`
   - `private_key` → Use for `FIREBASE_PRIVATE_KEY` (keep the quotes and \n characters)

**Important:** When copying the private key, keep the entire key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`, and replace actual newlines with `\n` in the .env file.

## Step 3: Run the Application

```bash
npm run dev
```

This will start:
- Express server on port 3000 (handles API routes)
- React app on port 3001 (proxied through Express)

Open `http://localhost:3000` in your browser.

## Troubleshooting

### Error: "Service account object must contain a string 'project_id' property"
- Make sure your `.env` file exists in the root directory
- Check that `FIREBASE_PROJECT_ID` is set correctly
- Restart the server after creating/updating `.env`

### Error: "Cannot POST /api/f/[formId]"
- Make sure you're running `npm run dev` (not just `npm start`)
- Check that both servers started successfully
- Verify your `.env` file has all required Firebase Admin credentials

