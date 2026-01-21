# Firebase Password Reset Email Customization Guide

## Overview
This guide explains how to customize the password reset email template in Firebase to improve deliverability and branding.

---

## Method 1: Customize Email Template in Firebase Console (Recommended)

### Step 1: Access Email Templates
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (e.g., `fir-1e4bf`)
3. Navigate to **Authentication** → **Templates** (in the left sidebar)
4. Click on **Password reset** template

### Step 2: Customize the Email

#### A. Email Subject
- **Default**: "Reset your password"
- **Custom**: Change to something like "Reset Your Password - [Your App Name]"

#### B. Email Body (HTML)
You can customize the email content with HTML. Here's a sample template:

```html
Hello,

Follow this link to reset your password for your {{email}} account.

{{link}}

If you didn't ask to reset your password, you can ignore this email.

Thanks,
{{appName}} Team
```

**Available Variables:**
- `{{email}}` - User's email address
- `{{link}}` - Password reset link (automatically generated)
- `{{appName}}` - Your app name (set in Firebase project settings)

#### C. Action URL (Optional)
- **Default**: `https://[project-id].firebaseapp.com/__/auth/action`
- **Custom**: You can set a custom domain if you have one configured

### Step 3: Save Changes
Click **Save** to apply your changes. The new template will be used for all future password reset emails.

---

## Method 2: Use Custom Email Domain (Advanced - Better Deliverability)

### Why Use Custom Domain?
- ✅ Better email deliverability (less likely to go to spam)
- ✅ Professional branding
- ✅ Better sender reputation
- ✅ Custom email address (e.g., `noreply@yourdomain.com`)

### Step 1: Configure Custom Domain in Firebase

1. Go to **Authentication** → **Settings** → **Authorized domains**
2. Click **Add domain**
3. Enter your custom domain (e.g., `yourdomain.com`)
4. Follow Firebase's instructions to verify domain ownership

### Step 2: Update Email Templates

1. Go to **Authentication** → **Templates** → **Password reset**
2. In the **Action URL** field, enter:
   ```
   https://yourdomain.com/__/auth/action
   ```
3. Update the email body to use your custom domain

### Step 3: Configure DNS Records (For Better Deliverability)

Add these DNS records to your domain:

#### SPF Record
```
TXT record: v=spf1 include:_spf.google.com ~all
```

#### DKIM Record
Firebase will provide you with DKIM records to add.

#### DMARC Record (Optional but Recommended)
```
TXT record: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

---

## Method 3: Custom Action URL (Redirect to Your App)

If you want to handle password reset in your own app:

### Step 1: Create Password Reset Page

Create a page in your React app (e.g., `src/pages/ResetPassword.jsx`):

```jsx
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "../firebase";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const oobCode = searchParams.get("oobCode");

  useEffect(() => {
    if (oobCode) {
      verifyPasswordResetCode(auth, oobCode)
        .then(() => setVerified(true))
        .catch((err) => setError("Invalid or expired reset link"));
    }
  }, [oobCode]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      navigate("/login", { state: { message: "Password reset successful!" } });
    } catch (err) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  }

  if (!oobCode) {
    return <div>Invalid reset link</div>;
  }

  if (!verified) {
    return <div>Verifying reset link...</div>;
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7] flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl p-8 space-y-6">
        <h1 className="text-3xl font-bold text-gray-900 text-center">Reset Password</h1>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Password
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm"
              placeholder="Enter new password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm"
              placeholder="Confirm new password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 rounded-2xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:bg-blue-300"
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

### Step 2: Update Firebase Action URL

In Firebase Console → Authentication → Templates → Password reset:
- Set **Action URL** to: `https://yourdomain.com/reset-password`

### Step 3: Add Route

Add the route in your `App.js`:

```jsx
import ResetPassword from "./pages/ResetPassword";

// In your routes:
<Route path="/reset-password" element={<ResetPassword />} />
```

---

## Best Practices to Avoid Spam

### 1. Customize Email Content
- Use a clear, professional subject line
- Include your app/brand name
- Avoid spam trigger words (FREE, URGENT, etc.)

### 2. Use Custom Domain
- Configure your own domain for better reputation
- Set up SPF/DKIM records properly

### 3. Monitor Email Deliverability
- Check spam rates in Firebase Console
- Ask users to mark emails as "Not Spam" if they go to spam
- Consider using a dedicated email service (SendGrid, Mailgun) for production

### 4. Email Template Example (Professional)

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; }
    .footer { margin-top: 30px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Reset Your Password</h2>
    <p>Hello,</p>
    <p>We received a request to reset your password for your {{email}} account.</p>
    <p>Click the button below to reset your password:</p>
    <p><a href="{{link}}" class="button">Reset Password</a></p>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #0066cc;">{{link}}</p>
    <p>This link will expire in 1 hour.</p>
    <p>If you didn't request a password reset, you can safely ignore this email.</p>
    <div class="footer">
      <p>Thanks,<br>{{appName}} Team</p>
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
```

---

## Quick Start: Minimal Customization

**Fastest way to improve deliverability:**

1. Go to Firebase Console → Authentication → Templates
2. Click **Password reset**
3. Update **Email subject** to: `"Reset Your Password - [Your App Name]"`
4. Update **Email body** to include your app name and better formatting
5. Click **Save**

This simple change can significantly improve email deliverability!

---

## Testing

After customizing:
1. Test the password reset flow from your login page
2. Check that the email arrives (check spam folder too)
3. Verify the reset link works correctly
4. Test on different email providers (Gmail, Outlook, etc.)

---

## Troubleshooting

### Emails Still Going to Spam?
- ✅ Customize the email template (don't use default)
- ✅ Use a custom domain if possible
- ✅ Set up SPF/DKIM records
- ✅ Ask users to mark as "Not Spam"
- ✅ Monitor and improve over time

### Reset Link Not Working?
- Check that the Action URL is correct
- Verify the oobCode is being passed correctly
- Check browser console for errors
- Ensure your domain is authorized in Firebase

---

## Current Implementation

Your code currently uses the default Firebase email:

**Location**: `src/context/AuthContext.jsx`
```javascript
function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}
```

This will automatically use whatever template you configure in Firebase Console - no code changes needed!

---

## Next Steps

1. **Immediate**: Customize the email template in Firebase Console (5 minutes)
2. **Short-term**: Set up a custom domain (if you have one)
3. **Long-term**: Consider using a dedicated email service for production apps

---

## Resources

- [Firebase Email Templates Documentation](https://firebase.google.com/docs/auth/custom-email-handler)
- [Firebase Custom Domain Setup](https://firebase.google.com/docs/auth/custom-domain)
- [Email Deliverability Best Practices](https://support.google.com/a/answer/33786)




