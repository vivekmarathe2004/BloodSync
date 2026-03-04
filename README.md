# BloodSync

Production-style blood donation management platform with role-based dashboards for donors, hospitals, and admins.

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.x-4479A1?logo=mysql&logoColor=white)
![JWT Auth](https://img.shields.io/badge/Auth-JWT-F7B93E)
![Architecture](https://img.shields.io/badge/Pattern-MVC-0A66C2)
![Frontend](https://img.shields.io/badge/Frontend-HTML%2FCSS%2FJS-E34F26?logo=html5&logoColor=white)

## Tags
`#BloodDonation` `#HealthcareTech` `#FullStack` `#NodeJS` `#ExpressJS` `#MySQL` `#JWT` `#MVC` `#DashboardUI` `#CollegeMajorProject`

## Highlights
- Secure authentication with JWT + HTTP-only cookies.
- Role-based modules for Admin, Hospital, and Donor.
- Donation requests, appointments, inventory updates, notifications, and analytics.
- Public camp discovery and donor camp registration flow.
- Export/report endpoints for admin and donor history.

## Tech Stack
- Frontend: HTML, CSS, Vanilla JS
- Backend: Node.js + Express (MVC)
- Database: MySQL
- Charts: Chart.js
- Auth: JWT + bcrypt

## Role Modules
- Public: landing stats, live camps listing.
- Donor: dashboard, profile, requests, appointments, camp registration, notifications, history.
- Hospital: dashboard, blood requests, donor matching/history, stock inventory, appointments, camps, profile.
- Admin: dashboard, user management, system requests/history/activity, camps, reports.

## Quick Start
1. Copy `.env.example` to `.env`.
2. Update database credentials in `.env`.
3. Import schema:
```bash
mysql -u root -p < server/database/schema.sql
```
4. Install dependencies:
```bash
npm install
```
5. Start in development mode:
```bash
npm run dev
```
6. Open:
```text
http://localhost:5000
```

## Environment Variables
| Variable | Description | Example |
|---|---|---|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Runtime mode | `development` |
| `CLIENT_URL` | Client origin for CORS | `http://localhost:5000` |
| `JWT_SECRET` | JWT signing secret | `change_this_secret` |
| `JWT_EXPIRES_IN` | JWT expiry window | `1d` |
| `DB_HOST` | MySQL host | `localhost` |
| `DB_USER` | MySQL user | `root` |
| `DB_PASSWORD` | MySQL password | `your_password` |
| `DB_NAME` | Database name | `blood_donation_db` |
| `DB_PORT` | MySQL port | `3306` |

## NPM Scripts
- `npm run dev` -> start with `nodemon`
- `npm start` -> start with `node`
- `npm test` -> placeholder test script

## Project Structure
```text
client/
  admin/
  donor/
  hospital/
  pages/
  assets/
server/
  config/
  controllers/
  middleware/
  models/
  routes/
  database/
README.md
```

## API Endpoints
### Auth + Public
- `GET /api/public/landing`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Donor
- `GET /api/donor/dashboard`
- `POST /api/donor/requests/:requestId/respond`
- `GET /api/donor/appointments`
- `POST /api/donor/appointments`
- `PATCH /api/donor/appointments/:appointmentId/reschedule`
- `PATCH /api/donor/appointments/:appointmentId/cancel`
- `GET /api/donor/notifications`
- `PATCH /api/donor/notifications/:notificationId/read`
- `PATCH /api/donor/profile`
- `GET /api/donor/history/export`
- `GET /api/donor/certificate/:donationId`

### Hospital
- `GET /api/hospital/dashboard`
- `GET /api/hospital/profile`
- `PATCH /api/hospital/profile`
- `POST /api/hospital/requests`
- `PATCH /api/hospital/requests/:requestId`
- `PATCH /api/hospital/requests/:requestId/status`
- `POST /api/hospital/requests/:requestId/cancel`
- `POST /api/hospital/requests/:requestId/clone`
- `POST /api/hospital/requests/:requestId/repost`
- `POST /api/hospital/requests/:requestId/duplicate`
- `GET /api/hospital/requests`
- `POST /api/hospital/bulk-message`
- `POST /api/hospital/stock`
- `GET /api/hospital/donors/:donorId/history`
- `POST /api/hospital/donations/confirm`
- `GET /api/hospital/appointments`
- `PATCH /api/hospital/appointments/:appointmentId`
- `POST /api/hospital/announcements`

### Admin
- `GET /api/admin/dashboard`
- `DELETE /api/admin/users/:id`
- `PATCH /api/admin/users/:id/status`
- `GET /api/admin/requests`
- `GET /api/admin/history`
- `GET /api/admin/activity`
- `GET /api/admin/reports/export`
- `POST /api/admin/announcements`

## Demo Credentials (seeded)
- Admin: `admin@bloodsync.com` / `Password@123`
- Donor: `donor1@mail.com` / `Password@123`
- Hospital: `hosp1@mail.com` / `Password@123`

## UI Screenshots
### Public
![Home](docs/screenshots/index.png)
![Public Camps](docs/screenshots/camps.png)
![Login](docs/screenshots/login.png)
![Register](docs/screenshots/register.png)

### Dashboards
![Admin Dashboard](docs/screenshots/admin-dashboard.png)
![Donor Dashboard](docs/screenshots/donor-dashboard.png)
![Hospital Dashboard](docs/screenshots/hospital-dashboard.png)

### Donor UI
![Donor Appointments](docs/screenshots/donor-appointments.png)
![Donor Camps](docs/screenshots/donor-camps.png)
![Donor History](docs/screenshots/donor-history.png)
![Donor Notifications](docs/screenshots/donor-notifications.png)
![Donor Profile](docs/screenshots/donor-profile.png)
![Donor Requests](docs/screenshots/donor-requests.png)

### Hospital UI
![Hospital Analytics](docs/screenshots/hospital-analytics.png)
![Hospital Appointments](docs/screenshots/hospital-appointments.png)
![Hospital Camps](docs/screenshots/hospital-camps.png)
![Hospital Inventory](docs/screenshots/hospital-inventory.png)
![Hospital Profile](docs/screenshots/hospital-profile.png)
![Hospital Requests](docs/screenshots/hospital-requests.png)

### Admin UI
![Admin Camps](docs/screenshots/admin-camps.png)
![Admin Users](docs/screenshots/admin-users.png)
