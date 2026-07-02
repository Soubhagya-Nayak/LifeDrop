# LifeDrop Mobile App

Expo app for donors and users who need blood.

## Features
- Donor login/register
- Requester login/register via the **Need Blood** role
- Dashboard section for donor/requester actions
- Map section with **Open Google Map** buttons for request locations
- Health eligibility form for donors
- Profile section with role, blood group, and phone details

## Run
```bash
npm install
npm start
```

## API URL
The app auto-detects the Expo host and uses `http://<host>:5000/api`.

If needed, set:
```bash
EXPO_PUBLIC_API_URL=http://YOUR_HOST:5000/api
```

This avoids false “Invalid credentials” alerts caused by the app hitting the wrong backend URL.
