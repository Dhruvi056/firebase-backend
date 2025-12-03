# How to Get Firebase Admin SDK Credentials

## Step-by-Step Instructions:

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com/
   - Select your project (fir-1e4bf)

2. **Navigate to Service Accounts**
   - Click the gear icon (⚙️) next to "Project Overview"
   - Select "Project settings"
   - Click on the "Service accounts" tab

3. **Generate Private Key**
   - Click the "Generate new private key" button
   - A warning dialog will appear - click "Generate key"
   - A JSON file will automatically download

4. **Open the Downloaded JSON File**
   - The file will be named something like: `fir-1e4bf-firebase-adminsdk-xxxxx-xxxxxxxxxx.json`
   - Open it in a text editor (VS Code, Notepad, etc.)

5. **Copy the Values to Your .env File**
   - The JSON file will look like this:
   ```json
   {
     "type": "service_account",
     "project_id": "fir-1e4bf",
     "private_key_id": "...",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "firebase-adminsdk-xxxxx@fir-1e4bf.iam.gserviceaccount.com",
     ...
   }
   ```

6. **Add to Your .env File**
   - Copy `project_id` value → Use for `FIREBASE_PROJECT_ID`
   - Copy `client_email` value → Use for `FIREBASE_CLIENT_EMAIL`
   - Copy `private_key` value → Use for `FIREBASE_PRIVATE_KEY` (keep the quotes!)

## Example .env File Format:

```env
# React App Credentials (you already have these)
REACT_APP_FIREBASE_APIKEY=AIzaSyDWjspbdzDxChkNn9doFYWHexWw_EhbU8k
REACT_APP_FIREBASE_AUTH_DOMAIN=fir-1e4bf.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=fir-1e4bf
REACT_APP_FIREBASE_STORAGE_BUCKET=fir-1e4bf.firebasestorage.app
REACT_APP_FIREBASE_SENDER=770993138414
REACT_APP_FIREBASE_APPID=1:770993138414:web:7cf9bd29af808edd05a1ff
REACT_APP_FIREBASE_MEASUREMENT_ID=G-HVJYR29EW4

# Firebase Admin SDK Credentials (ADD THESE!)
FIREBASE_PROJECT_ID=fir-1e4bf
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@fir-1e4bf.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```

## Important Notes:

- The `FIREBASE_PRIVATE_KEY` must be in quotes (`"..."`)
- Keep the `\n` characters in the private key (they represent newlines)
- The private key should start with `-----BEGIN PRIVATE KEY-----` and end with `-----END PRIVATE KEY-----`
- After adding these, restart your server: `npm start`

