# Vercel Deployment Setup Guide

## Important: Environment Variables on Vercel

Agar aap Vercel par deploy kar rahe hain, to **environment variables Vercel dashboard me set karni hongi**. Local `.env` file Vercel par kaam nahi karega.

## Step 1: Vercel Dashboard me Environment Variables Add Karein

1. **Vercel Dashboard** me jayein: https://vercel.com/dashboard
2. Apna project select karein
3. **Settings** tab par click karein
4. **Environment Variables** section me jayein
5. Neeche diye gaye variables add karein:

### Required Environment Variables:

```env
FIREBASE_PROJECT_ID=fir-1e4bf
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@fir-1e4bf.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```

### Optional (React App ke liye):

```env
REACT_APP_FIREBASE_APIKEY=AIzaSyDWjspbdzDxChkNn9doFYWHexWw_EhbU8k
REACT_APP_FIREBASE_AUTH_DOMAIN=fir-1e4bf.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=fir-1e4bf
REACT_APP_FIREBASE_STORAGE_BUCKET=fir-1e4bf.firebasestorage.app
REACT_APP_FIREBASE_SENDER=770993138414
REACT_APP_FIREBASE_APPID=1:770993138414:web:7cf9bd29af808edd05a1ff
REACT_APP_FIREBASE_MEASUREMENT_ID=G-HVJYR29EW4
```

## Step 2: Environment Variables Kaise Add Karein

1. **Key** field me variable ka naam daalein (e.g., `FIREBASE_PROJECT_ID`)
2. **Value** field me variable ki value daalein
3. **Environment** select karein:
   - **Production** - Live deployment ke liye
   - **Preview** - Preview deployments ke liye  
   - **Development** - Local development ke liye
4. **Add** button click karein
5. Har variable ke liye repeat karein

## Step 3: FIREBASE_PRIVATE_KEY Format

**Important:** Private key ko **single line** me daalein with `\n` characters:

```
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...very long key...\n-----END PRIVATE KEY-----\n"
```

- Quotes (`"..."`) me wrap karein
- `\n` characters ko as-is rakhein (actual newlines nahi)
- Entire key copy karein from your JSON file

## Step 4: Redeploy

Environment variables add karne ke baad:

1. **Deployments** tab me jayein
2. Latest deployment par **three dots** (...) click karein
3. **Redeploy** select karein
4. Ya naya commit push karein (auto-deploy hoga)

## Step 5: Test Karein

1. Apna form URL test karein:
   ```
   https://firebase-backend-b4b92tjg7-dhruvi056s-projects.vercel.app/api/f/fndt2nlr
   ```

2. Form submit karein aur check karein ki data Firestore me save ho raha hai

## Troubleshooting

### Error: "Firebase not initialized"
- Check karein ki environment variables Vercel me set hain
- Private key format sahi hai (single line with `\n`)
- Redeploy karein after adding variables

### Error: "Missing formId"
- URL me formId check karein
- Form action URL sahi hai

### Form submit nahi ho raha
- Browser console me errors check karein
- Network tab me request check karein
- Vercel function logs check karein (Deployments → Function Logs)

## Quick Checklist

- [ ] FIREBASE_PROJECT_ID set hai
- [ ] FIREBASE_CLIENT_EMAIL set hai  
- [ ] FIREBASE_PRIVATE_KEY set hai (single line, with quotes)
- [ ] All variables Production environment me set hain
- [ ] Project redeploy ho chuka hai
- [ ] Form URL test kar chuke hain

## Vercel CLI se Environment Variables Set Karna (Alternative)

Agar aap CLI use karna chahte hain:

```bash
vercel env add FIREBASE_PROJECT_ID
vercel env add FIREBASE_CLIENT_EMAIL
vercel env add FIREBASE_PRIVATE_KEY
```

Har command ke baad value enter karni hogi.

