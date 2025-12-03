# VS Code me Project Kaise Run Karein

## Problem
Project Cursor me chal raha hai but VS Code me nahi chal raha.

## Solutions

### Solution 1: VS Code Terminal me Proper Command Use Karein

VS Code me terminal open karein:
1. `Ctrl + `` (backtick) ya `View → Terminal`
2. Terminal me yeh command run karein:

```bash
npm run dev
```

**Important:** `npm start` mat use karein - yeh sirf Express server chalata hai.

### Solution 2: VS Code Terminal Type Check Karein

VS Code me different terminals ho sakte hain:
- PowerShell (Windows default)
- Command Prompt
- Git Bash

**Try karein:**
1. Terminal dropdown me click karein (top right)
2. "Select Default Profile" choose karein
3. "PowerShell" ya "Command Prompt" select karein
4. Naya terminal open karein
5. `npm run dev` run karein

### Solution 3: VS Code me Environment Variables

VS Code me `.env` file properly load nahi ho rahi ho sakti hai.

**Check karein:**
1. `.env` file project root me hai ya nahi
2. VS Code me file open karein aur verify karein ki sahi format me hai
3. Terminal me check karein:
   ```bash
   # PowerShell me
   Get-Content .env
   ```

### Solution 4: VS Code Workspace Settings

VS Code me workspace settings check karein:

1. `.vscode/settings.json` file create karein (agar nahi hai):
   ```json
   {
     "terminal.integrated.defaultProfile.windows": "PowerShell",
     "terminal.integrated.env.windows": {
       "NODE_ENV": "development"
     }
   }
   ```

### Solution 5: VS Code Extensions

VS Code me kuch extensions issue create kar sakte hain:

1. **Disable extensions temporarily:**
   - `Ctrl + Shift + P`
   - "Disable All Installed Extensions" type karein
   - Terminal me `npm run dev` run karein

2. **Useful extensions:**
   - ESLint (agar linter errors hain)
   - Prettier (code formatting)

### Solution 6: VS Code Terminal me Path Issue

VS Code terminal me project directory me nahi ho sakte hain.

**Check karein:**
1. Terminal me current directory check karein:
   ```bash
   pwd  # Linux/Mac
   cd   # Windows
   ```

2. Agar project directory me nahi hain, to navigate karein:
   ```bash
   cd "C:\Users\Radadiya Dhruvi\Desktop\Form-Backend Project\firebase-backend"
   ```

3. Phir `npm run dev` run karein

### Solution 7: VS Code me Port Already in Use

VS Code me port already use ho rahi ho sakti hai.

**Fix:**
```powershell
# PowerShell me
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process -Force
```

### Solution 8: VS Code Terminal Output Check Karein

VS Code terminal me errors check karein:

1. Terminal me `npm run dev` run karein
2. Output carefully read karein
3. Agar koi error hai, to share karein

## Quick Checklist for VS Code

- [ ] Terminal type sahi hai (PowerShell/CMD)
- [ ] Project directory me hain
- [ ] `.env` file exist karti hai
- [ ] `npm install` run kar chuke hain
- [ ] Ports 3000 aur 3001 available hain
- [ ] `npm run dev` use kar rahe hain (not `npm start`)

## VS Code me Recommended Settings

`.vscode/settings.json` file me yeh add karein:

```json
{
  "terminal.integrated.defaultProfile.windows": "PowerShell",
  "files.exclude": {
    "**/.git": true,
    "**/.DS_Store": true,
    "**/node_modules": true
  },
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

## Alternative: VS Code Tasks Use Karein

VS Code me tasks.json create karein:

`.vscode/tasks.json`:
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start Dev Server",
      "type": "npm",
      "script": "dev",
      "problemMatcher": [],
      "presentation": {
        "reveal": "always",
        "panel": "new"
      }
    }
  ]
}
```

Phir `Ctrl + Shift + P` → "Tasks: Run Task" → "Start Dev Server"


