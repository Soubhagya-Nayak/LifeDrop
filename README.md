# LifeDrop – Smart Emergency Blood Donation System

LifeDrop connects hospitals and patients with nearby blood donors during emergencies.
The system notifies compatible donors, ranks them by distance, assigns the closest as the **Primary Donor**, and automatically promotes backup donors if the primary fails to arrive.

---

## Project Structure

```
LifeDrop/
├── server/          Express.js backend + MySQL
├── client/          React (Vite) web admin panel
└── mobile/          React Native / Expo mobile app
```

---

## Technology Stack

| Layer       | Technology                                    |
|-------------|-----------------------------------------------|
| Mobile      | React Native · Expo Router · Axios · Lucide   |
| Backend     | Node.js · Express.js                          |
| Database    | MySQL 8+                                      |
| Auth        | JWT (jsonwebtoken)                            |
| QR Codes    | `qrcode` (server) · `expo-camera` (mobile)   |
| Push Alerts | Firebase Cloud Messaging (optional)           |
| Maps        | Google Maps API (admin web panel)             |
| Location    | expo-location (Haversine formula backend)     |

---

## Quick Start

### Prerequisites

- Node.js 18+
- MySQL 8+
- Expo CLI (`npm install -g expo-cli`)

---

### 1 · Database Setup

Open MySQL and run:

```sql
source path/to/LifeDrop/server/schema.sql
```

This creates the `lifedrop` database and all tables.

---

### 2 · Backend (server)

```bash
cd server
cp .env.example .env
# Edit .env with your DB credentials
npm install
node server.js
```

The server starts on **http://localhost:5000**.

Verify: `GET http://localhost:5000/api/ping` → `{"status":"ok"}`

**Default admin account** is created automatically on first start:
- Phone: `6372024022`
- Password: `kanha#143`

#### Optional: Firebase Push Notifications

1. Create a Firebase project at https://console.firebase.google.com
2. Go to Project Settings → Service Accounts → Generate new private key
3. Fill in `.env`:
   ```
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

Push notifications are optional — the system falls back to in-app DB notifications when Firebase is not configured.

---

### 3 · Web Admin Panel (client)

```bash
cd client
cp .env.example .env    # if .env.example exists
# or create client/.env with:
# VITE_API_URL=http://localhost:5000/api
# VITE_GOOGLE_MAPS_API_KEY=your_google_maps_key   (optional, for map view)
npm install
npm run dev
```

Admin panel opens at **http://localhost:5173**.
Log in with the admin credentials above.

---

### 4 · Mobile App (mobile)

```bash
cd mobile
cp .env.example .env
# Edit .env if needed (default: auto-detects local server via Expo host)
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your phone, or press `a` for Android / `i` for iOS simulator.

> **Network tip:** Your phone and computer must be on the same Wi-Fi. The app auto-detects the server IP via `Constants.expoConfig.hostUri`. If that fails, set `EXPO_PUBLIC_API_URL=http://<your-computer-ip>:5000/api` in `mobile/.env`.

---

## API Endpoints

| Method | Path                               | Auth   | Description                            |
|--------|------------------------------------|--------|----------------------------------------|
| POST   | /api/auth/register                 | –      | Register donor / hospital              |
| POST   | /api/auth/login                    | –      | Login and receive JWT                  |
| POST   | /api/auth/location                 | ✅     | Update user GPS coordinates            |
| POST   | /api/health/submit                 | ✅     | Submit health screening                |
| POST   | /api/request/create                | ✅     | Create blood request (hospital)        |
| GET    | /api/request/dashboard             | ✅     | Donor/hospital dashboard data          |
| GET    | /api/request/nearby-donors/:id     | ✅     | List compatible donors near a request  |
| POST   | /api/request/accept                | ✅     | Donor accepts a request                |
| POST   | /api/request/cancel                | ✅     | Donor withdraws from a request         |
| POST   | /api/donation/generate-qr          | ✅     | Primary donor generates QR code        |
| POST   | /api/donation/verify               | ✅     | Hospital verifies donor QR             |
| POST   | /api/donation/scan-patient-qr      | ✅     | Donor scans patient QR to complete     |
| GET    | /api/donation/history              | ✅     | Donation history for current user      |
| GET    | /api/admin/overview                | Admin  | Full admin dashboard data              |
| POST   | /api/admin/donor-eligibility       | Admin  | Approve / reject donor health          |
| POST   | /api/admin/request-donor-review    | Admin  | Approve / reject donor for a request   |
| POST   | /api/admin/reset-data              | Admin  | Wipe all non-admin data (dev only)     |

---

## Mobile App Screens

| Screen          | File                  | Description                                    |
|-----------------|-----------------------|------------------------------------------------|
| Dashboard       | app/index.js          | Donor alerts + hospital request form           |
| Login           | app/login.js          | Phone + password sign-in                       |
| Register        | app/register.js       | New account with Aadhaar + GPS                 |
| Health Check    | app/health.js         | Donor eligibility questionnaire                |
| Profile         | app/profile.js        | User info + sign-out                           |
| QR Scanner      | app/scan-qr.js        | Donor scans patient QR to complete donation    |
| Generate QR     | app/generate-qr.js    | Primary donor generates their verification QR  |
| Nearby Donors   | app/donors.js         | Hospital views compatible donors on map        |

---

## Key Features

### Smart Donor Ranking
When multiple donors accept a request, the backend sorts them by Haversine distance and assigns ranks. The closest donor becomes **Primary Donor**; others are **Backup Donors**.

### Blood Compatibility
Full ABO/Rh compatibility matrix is implemented in `server/utils/compatibility.js`.

### Donation Cooldown
Donors must wait **112 days** after donating before becoming eligible again.

### QR Verification Flow
1. Hospital creates a request → patient QR is generated automatically.
2. Admin approves the primary donor → status moves to `Donation In Progress`.
3. Donor navigates to **Generate My Donor QR** and shows it to hospital staff.
4. Hospital staff scans the donor QR in the app to complete the donation.
5. Alternatively: the approved donor scans the patient QR shown by the hospital.

### Reward Badges
| Donations | Badge         |
|-----------|---------------|
| 1         | First Saver   |
| 5         | Life Helper   |
| 10        | Blood Hero    |
| 20        | Super Donor   |

### Emergency Escalation
If no donor accepts within 5 minutes the search radius automatically expands from 10 km to 20 km (logic tracked in the request lifecycle).

---

## Database Schema

See `server/schema.sql` for the full DDL. Tables:

- `Users` — donors, hospitals, admins
- `HealthInfo` — donor eligibility data
- `BloodRequests` — patient blood requests
- `Donations` — donation records with QR hash
- `BackupDonors` — ranked donor queue per request
- `Hospitals` — hospital license info
- `Notifications` — in-app notification log

---

## Troubleshooting

**"Cannot connect to server" on mobile**
- Ensure phone and computer are on the same Wi-Fi network.
- Set `EXPO_PUBLIC_API_URL=http://<your-ip>:5000/api` in `mobile/.env`.

**"User already exists" on register**
- The phone number is already registered. Try logging in.

**Donor cannot accept request**
- Donor must complete health screening and be Aadhaar-verified by admin.
- Donor must be within 10 km of the request.
- Donation cooldown must have elapsed (112 days).

**QR generation fails**
- Only the **primary donor** (rank 1 in the queue, or the admin-approved donor) can generate a QR code.

---

## License

MIT — see [LICENSE](LICENSE) for details.
