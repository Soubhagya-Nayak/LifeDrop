# LifeDrop

LifeDrop is a full-stack blood donation and emergency blood request platform with an admin web dashboard and a mobile app for donors and blood requesters. The system helps match compatible donors with nearby patients, verifies users through Aadhaar details, tracks donor eligibility, supports QR-based donation verification, and keeps donation history after completion.

## Project Modules

- **Admin Web App**: Admin dashboard for monitoring donors, patient requests, eligibility, assignments, distance, map locations, and donation history.
- **Mobile App**: User app where a person can register, donate blood, request blood, scan patient QR codes, view profile, update health eligibility, and check history.
- **Backend API**: Express and MySQL REST API for authentication, blood requests, donor matching, admin controls, QR verification, history, and notifications.
- **Database**: MySQL schema for users, health information, blood requests, donations, backup donors, hospitals, and notifications.

## Key Features

- Admin login and protected admin dashboard.
- Mobile registration with Aadhaar number and Aadhaar document metadata.
- Mandatory phone location access for donors and requesters.
- Google Maps integration for donor and receiver locations.
- Blood group compatibility matching.
- Donor matching within a 10 km radius.
- Same person cannot donate to their own request.
- One blood request per device/account per day.
- Admin approval and rejection for donor eligibility.
- Admin can see donor assignment status as Primary or Backup.
- QR code generated for every patient request.
- Donor scans patient QR code to complete donation for the correct receiver.
- Completed requests are removed from active dashboards and stored in history.
- Donor cooldown of 112 days after donation.
- Cooldown donors are blocked from donating and hidden from admin donor checks.
- Matching blood group donors receive request notifications.
- Admin reset option to remove operational donor/receiver data while preserving admin.

## Tech Stack

### Frontend Admin Web

- React 19
- Vite
- Tailwind CSS
- React Router
- Axios
- Lucide React Icons
- Google Maps via `@react-google-maps/api`

### Mobile App

- React Native
- Expo
- Expo Router
- Expo Location
- Expo Camera
- Expo Document Picker
- AsyncStorage
- Axios
- Lucide React Native Icons

### Backend

- Node.js
- Express.js
- MySQL
- MySQL2
- JSON Web Token authentication
- bcrypt password hashing
- QR code generation
- dotenv environment configuration

### Database

- MySQL
- Tables include:
- `Users`
- `HealthInfo`
- `Hospitals`
- `BloodRequests`
- `Donations`
- `BackupDonors`
- `Notifications`

## Folder Structure

```text
LifeDrop/
  client/                 Admin web app
  mobile/                 Expo mobile app
  server/                 Express API server
  API_DOCUMENTATION.md    API reference
  ER_DIAGRAM.md           Database relationship notes
  README.md               Project documentation
```

## Setup Instructions

### 1. Clone Repository

```bash
git clone <your-repository-url>
cd LifeDrop
```

### 2. Setup MySQL Database

Create a MySQL database:

```sql
CREATE DATABASE lifedrop;
```

Import or run the schema:

```bash
cd server
mysql -u root -p lifedrop < schema.sql
```

### 3. Backend Setup

```bash
cd server
npm install
```

Create `server/.env`:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=lifedrop
JWT_SECRET=your_jwt_secret
PORT=5000
```

Run backend:

```bash
npm start
```

The backend runs on:

```text
http://localhost:5000
```

### 4. Admin Web Setup

```bash
cd client
npm install
```

Create `client/.env`:

```env
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

Run admin web:

```bash
npm run dev
```

The admin web app usually runs on:

```text
http://localhost:5173
```

### 5. Mobile App Setup

```bash
cd mobile
npm install
npx expo start
```

Use Expo Go or an emulator to run the mobile app.

If Metro cache causes issues:

```bash
npx expo start -c
```

## Default Admin Login

The backend automatically creates a default admin if no admin exists.

```text
Phone: 6372024022
Password: kanha#143
```

## Main User Flow

### Requester Flow

1. Register in mobile app with Aadhaar details and location permission.
2. Choose **Need Blood** inside the app.
3. Submit patient blood request with patient Aadhaar details.
4. System generates a patient QR code.
5. Compatible nearby donors are notified.
6. After donor scans the patient QR code, the request is completed.
7. Completed request moves to History.

### Donor Flow

1. Register in mobile app with Aadhaar details and location permission.
2. Choose **Donate Blood** inside the app.
3. Update health eligibility.
4. View nearby compatible requests within 10 km.
5. Accept request if eligible and not in cooldown.
6. Reach patient location and scan patient QR code.
7. Donation is completed and donor enters 112-day cooldown.

### Admin Flow

1. Login through the web admin panel.
2. Review donors and patient requests.
3. Approve or reject donor eligibility.
4. Check donor-patient distance on map.
5. See assigned donor role as Primary or Backup.
6. View date-wise donation history.
7. Reset operational data when needed.

## Important Business Rules

- A user cannot donate blood to their own request.
- A donor must be within 10 km of the receiver.
- A donor must be Aadhaar verified and eligibility approved.
- A donor cannot donate again for 112 days after a completed donation.
- One device/account can create only one blood request per day.
- Completed requests are removed from active dashboards and stored in history.
- Only compatible blood group donors are notified.

## API Overview

Main route groups:

```text
/api/auth       Authentication, registration, login, location update
/api/health     Donor health eligibility
/api/request    Blood request creation, dashboard, donor acceptance
/api/donation   QR scan verification and donation history
/api/admin      Admin overview, eligibility, reset, donor review
```

See `API_DOCUMENTATION.md` for endpoint-level documentation.

## Environment Variables

### Server

```env
DB_HOST=
DB_USER=
DB_PASSWORD=
DB_NAME=
JWT_SECRET=
PORT=
```

### Client

```env
VITE_GOOGLE_MAPS_API_KEY=
```

## Notes

- Aadhaar document handling currently stores submitted document metadata/URI from the app flow.
- For production, use secure file upload storage, HTTPS, stronger role management, secure JWT secrets, and protected environment variables.
- Google Maps requires a valid API key with the correct platform restrictions enabled.
