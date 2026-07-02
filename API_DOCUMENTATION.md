# API Documentation - LifeDrop Backend

## Base URL
`http://localhost:5000/api`

## Authentication

### `POST /auth/register`
Registers a new account.
- **Body:** `{ "name", "phone", "password", "blood_group", "latitude", "longitude", "role" }`
- **Roles:** `donor` for donors, `hospital` for mobile blood requesters, `admin` for web admins
- **Response:** `201 Created`

### `POST /auth/login`
Authenticates a user and returns a JWT token.
- **Body:** `{ "phone", "password" }`
- **Response:** `{ "token", "user": { "id", "name", "phone", "role", "bloodGroup", "donationCount", "availabilityStatus" } }`

## Health

### `POST /health/submit`
Submits health screening info and returns eligibility.
- **Headers:** `Authorization: Bearer <token>`
- **Body:** `{ "age", "weight", "has_fever", "has_hiv", "has_hepatitis", "recent_surgery" }`
- **Response:** `{ "msg": "Health info submitted", "eligibility_status": "Eligible" }`

## Mobile Dashboard / Requests

### `GET /request/dashboard`
Returns donor or requester dashboard data for the logged-in mobile user.
- **Headers:** `Authorization: Bearer <token>`
- **Response (donor):** `{ "mode": "donor", "donor": { ... }, "requests": [...] }`
- **Response (requester):** `{ "mode": "hospital", "requests": [...] }`

### `POST /request/create`
Creates a new blood request for mobile requester accounts (`role=hospital`).
- **Headers:** `Authorization: Bearer <token>`
- **Body:** `{ "patient_name", "blood_group_required", "latitude", "longitude", "units_required", "emergency_level" }`

### `GET /request/nearby-donors/:requestId`
Gets eligible nearby donors for a request.
- **Headers:** `Authorization: Bearer <token>`
- **Response:** `{ "donors": [...], "radius": 10 }`

### `POST /request/accept`
Accepts a request and returns donor queue rank.
- **Headers:** `Authorization: Bearer <token>`
- **Body:** `{ "requestId" }`
- **Response:** `{ "msg": "Request accepted", "rank": 1 }`

### `POST /request/cancel`
Cancels an accepted request and re-ranks backup donors.
- **Headers:** `Authorization: Bearer <token>`
- **Body:** `{ "requestId" }`

## Donation

### `POST /donation/generate-qr`
Generates a QR code for a donation.
- **Headers:** `Authorization: Bearer <token>`
- **Body:** `{ "requestId" }`
- **Response:** `{ "qrCode": "<base64_string>" }`

### `POST /donation/verify`
Verifies a donor QR and marks donation/request as complete.
- **Headers:** `Authorization: Bearer <token>`
- **Body:** `{ "qrDataString" }`
- **Response:** `{ "msg": "QR Verified and Donation Complete" }`

## Admin

### `GET /admin/overview`
Returns admin dashboard stats, donor list, and patient request list.
- **Headers:** `Authorization: Bearer <admin-token>`
- **Response:** `{ "stats": { ... }, "donors": [...], "patients": [...] }`
