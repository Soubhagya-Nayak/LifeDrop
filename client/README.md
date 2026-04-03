# LifeDrop Admin Web

React + Vite admin dashboard for LifeDrop.

## Features
- Admin-only login
- Dashboard stats cards
- Google Map section with donor and patient markers
- Patient request section
- Donor eligibility/profile/location table

## Run
```bash
npm install
npm run dev
```

## Google Maps
Create `client/.env`:
```bash
VITE_GOOGLE_MAPS_API_KEY=your_key
```

If the key is missing, the dashboard still loads and shows a setup message in the map section.
