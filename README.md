<h1 align="center">BloodSync</h1>
<p align="center"><b>Role-Based Blood Donation Management Platform</b></p>
<p align="center">Built for faster donor-hospital coordination, transparent operations, and safer blood availability tracking.</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/MySQL-8.x-4479A1?logo=mysql&logoColor=white" alt="MySQL" />
  <img src="https://img.shields.io/badge/Auth-JWT%20%2B%20bcrypt-F7B93E" alt="Auth" />
  <img src="https://img.shields.io/badge/Architecture-MVC-0A66C2" alt="MVC" />
  <img src="https://img.shields.io/badge/Frontend-HTML%2FCSS%2FVanilla%20JS-E34F26?logo=html5&logoColor=white" alt="Frontend" />
</p>

<p align="center">
  <a href="#problem--vision">Problem & Vision</a> |
  <a href="#solution-overview">Solution</a> |
  <a href="#feature-matrix">Features</a> |
  <a href="#architecture">Architecture</a> |
  <a href="#ui-screenshots">Screenshots</a>
</p>

## Tags
`#BloodDonation` `#HealthcareTech` `#FullStack` `#NodeJS` `#ExpressJS` `#MySQL` `#JWT` `#MVC` `#DashboardUI` `#MajorProject`

## Problem & Vision
Hospitals need blood quickly, while donors need trustworthy, timely, and nearby opportunities to donate. Manual coordination causes delay, low visibility, and weak tracking.

BloodSync addresses this by providing:
- A real-time request workflow for hospitals
- Actionable dashboards for donors and admins
- Unified tracking of appointments, donations, camps, and stock

## Solution Overview
BloodSync is a multi-role platform where each actor gets a purpose-built interface:
- Donor: respond to requests, schedule appointments, manage profile, track history
- Hospital: raise urgent requests, manage stock, confirm donations, run camps
- Admin: govern users, monitor activity, review reports, publish announcements
- Public visitor: explore platform stats and upcoming donation camps

## Feature Matrix
| Capability | Public | Donor | Hospital | Admin |
|---|---:|---:|---:|---:|
| Register / Login | Yes | Yes | Yes | Yes |
| Dashboard | No | Yes | Yes | Yes |
| Blood Requests | View camps only | Respond | Create/Update | Monitor |
| Appointments | No | Book/Reschedule/Cancel | Manage/Confirm | Monitor |
| Notifications | No | Yes | Yes | Yes |
| Inventory Tracking | No | No | Yes | Analytics |
| Camp Management | View | Join | Create/Manage | Create/Manage |
| Reports Export | No | History export | Stock export | System export |

## End-to-End Workflows
### 1) Emergency Request to Donation Completion
1. Hospital creates blood request with urgency and location.
2. Compatible donors receive visibility and respond.
3. Donor books appointment slot.
4. Hospital confirms appointment and verifies donation.
5. Donation record is logged and history/report data updates.

### 2) Camp Operations Flow
1. Admin/Hospital creates donation camp.
2. Donors register for upcoming camp.
3. Organizer marks attendance and donation units.
4. Camp analytics and donation records update.

## Architecture
```text
Client (HTML/CSS/Vanilla JS)
   -> Express Route Layer
      -> Middleware (auth, role, validation, error handling)
         -> Controllers (business logic)
            -> Models (SQL operations)
               -> MySQL
```

### Backend Design
- Pattern: MVC with clear route/controller/model separation
- Security middleware: auth guard + role guard
- Validation: `express-validator` for request payload checks
- Error handling: centralized middleware
- Compatibility logic: blood-group matching utility

## Data Model Snapshot
Core entities implemented in schema:
- Identity: `users`, `donors`, `hospitals`
- Operations: `blood_requests`, `request_responses`, `appointments`, `donations`
- Engagement: `notifications`, `announcements`, `donor_feedback`
- Inventory: `blood_stock`, `stock_transactions`
- Governance: `activity_logs`
- Campaigns: `camps`, `camp_registrations`, `camp_attendance`, `camp_donations`

### Seed Data Included
- 1 admin user
- 4 donor users
- 2 hospital users
- sample blood requests, stock, and activity logs

## Tech Stack
| Layer | Stack |
|---|---|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Backend | Node.js, Express.js |
| Database | MySQL (`mysql2`) |
| Auth | JWT + bcrypt + cookie-parser |
| Runtime Tools | nodemon, dotenv, cors |

## API Overview
### Public + Auth
- `GET /api/public/landing`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Donor
- Dashboard, request response, appointment actions
- Questionnaire and feedback submission
- Notifications (single + mark all)
- Profile updates and history export
- Camps (upcoming, register, cancel, registrations)

### Hospital
- Profile and dashboard
- Full request lifecycle (create/edit/status/cancel/clone/repost/duplicate)
- Bulk messaging and announcements
- Stock upsert, adjust, trends, transaction export
- Donor history and donation confirmation
- Camps management and attendance

### Admin
- Dashboard and user governance
- Request/history/activity views
- Reports export and system announcements
- Stock trends and transaction export
- Camps management and camps analytics

## Security & Validation
- Password hashing with bcrypt
- JWT-based session handling
- Role-based access control (`admin`, `donor`, `hospital`)
- CORS with controlled origin handling
- Input constraints for critical fields (blood groups, city options, rating range, units)

## Quick Start
1. Copy `.env.example` to `.env`.
2. Set MySQL credentials in `.env`.
3. Import DB schema:
```bash
mysql -u root -p < server/database/schema.sql
```
4. Install dependencies:
```bash
npm install
```
5. Run development server:
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
| `PORT` | Backend port | `5000` |
| `NODE_ENV` | Environment mode | `development` |
| `CLIENT_URL` | Allowed frontend origin | `http://localhost:5000` |
| `JWT_SECRET` | JWT signing secret | `change_this_secret` |
| `JWT_EXPIRES_IN` | JWT expiry time | `1d` |
| `DB_HOST` | MySQL host | `localhost` |
| `DB_USER` | MySQL user | `root` |
| `DB_PASSWORD` | MySQL password | `your_password` |
| `DB_NAME` | Database name | `blood_donation_db` |
| `DB_PORT` | MySQL port | `3306` |

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
  constants/
  controllers/
  database/
  middleware/
  models/
  routes/
```

## Demo Credentials (Seeded)
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

## Presentation Talking Points
- Real-world relevance: emergency response + healthcare coordination
- Complete lifecycle coverage: request -> donor action -> appointment -> donation -> reporting
- Multi-role product thinking with scoped permissions
- Structured backend engineering with maintainable MVC modules
- Extensible foundation for geo-matching, ML prioritization, and mobile clients

## Future Scope
- Geospatial donor matching using distance + ETA
- Notification channels via SMS/Email/WhatsApp
- Predictive blood shortage analytics
- Containerized deployment and CI test pipeline
