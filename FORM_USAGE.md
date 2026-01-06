# How to Use Firebase Form Endpoint

## For Existing Forms (Quick Setup)

Agar aapke paas already form hai, to sirf **ek line** add karo:

### Step 1: Form action mein endpoint URL add karo
```html
<form action="https://your-domain.com/api/f/YOUR_FORM_ID">
  <!-- your existing form fields -->
  <input name="fullName" />
  <input name="email" type="email" />
  <button type="submit">Submit</button>
</form>
```

### Step 2: Script tag add karo (form ke baad, closing `</body>` se pehle)
```html
<script src="https://your-domain.com/embed-form.js"></script>
```

**That's it!** Ab form submit par:
- ✅ No page navigation
- ✅ Toast message show hoga
- ✅ Response Network tab mein dikhega

---

## Complete Example

```html
<!DOCTYPE html>
<html>
<head>
    <title>Contact Form</title>
</head>
<body>
    <h1>Contact Us</h1>
    
    <form action="https://firebase-backend-el995q598-dhruvi056s-projects.vercel.app/api/f/4hdt5zg8">
        <input name="fullName" placeholder="Name" required />
        <input name="email" type="email" placeholder="Email" required />
        <textarea name="message" placeholder="Message"></textarea>
        <button type="submit">Send</button>
    </form>

    <!-- Add this ONE line -->
    <script src="https://firebase-backend-el995q598-dhruvi056s-projects.vercel.app/embed-form.js"></script>
</body>
</html>
```

---

## Alternative: Using data attribute

Agar aap `action` attribute use nahi karna chahte, to `data-firebase-form-endpoint` use kar sakte ho:

```html
<form data-firebase-form-endpoint="https://your-domain.com/api/f/YOUR_FORM_ID">
  <!-- form fields -->
</form>
<script src="https://your-domain.com/embed-form.js"></script>
```

---

## Important Notes

1. **Script tag zaroori hai** - Bina script ke form normal browser submission karega (navigation hoga)
2. **Script URL** - Form action ke domain ke saath match karo
3. **Works everywhere** - React, WordPress, plain HTML, kisi bhi site par

---

## Troubleshooting

**Problem:** Form submit par page navigate ho raha hai
**Solution:** Check karo ki script tag properly load ho raha hai (browser console check karo)

**Problem:** Toast nahi dikh raha
**Solution:** Browser console mein error check karo, script URL sahi hai ya nahi


