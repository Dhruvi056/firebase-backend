
This repo is split into two separate apps:

- `backend/`: Express + MongoDB API
- `frontend/`: React (Create React App) UI

## Run locally

### Backend

```bash
cd backend
copy .env.example .env
npm install
npm start
```

Default: `http://localhost:5000`

### Frontend

```bash
cd frontend
npm install
npm start
```

Default: `http://localhost:3000`

## Notes

- Your existing `.env` was left at repo root (for safety). Copy the values you need into `backend/.env`.
- The frontend calls the API via `/api/...` and uses `src/setupProxy.js` during development.
