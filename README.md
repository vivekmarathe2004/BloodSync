<h1 align="center">BloodSync</h1>
<p align="center"><b>Smart Blood Donation Coordination Platform</b></p>
<p align="center">A production-style full-stack system that connects donors, hospitals, and admins through secure, role-based workflows.</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/MySQL-8.x-4479A1?logo=mysql&logoColor=white" alt="MySQL" />
  <img src="https://img.shields.io/badge/Authentication-JWT%20%2B%20bcrypt-F7B93E" alt="Authentication" />
  <img src="https://img.shields.io/badge/Architecture-MVC-0A66C2" alt="Architecture" />
  <img src="https://img.shields.io/badge/Frontend-HTML%20%7C%20CSS%20%7C%20Vanilla%20JS-E34F26" alt="Frontend" />
</p>

<p align="center">
  <a href="#1-executive-summary">Executive Summary</a> |
  <a href="#2-problem-statement">Problem</a> |
  <a href="#3-solution--usp">Solution</a> |
  <a href="#6-system-architecture">Architecture</a> |
  <a href="#12-ui-showcase">UI Showcase</a>
</p>

---

## 1) Executive Summary
BloodSync is a centralized digital platform for blood donation operations. It reduces friction between hospitals needing blood and donors willing to help by providing:
- real-time blood request handling
- role-based action dashboards
- appointment and donation tracking
- inventory visibility and governance controls

This project is designed as a major-project-grade implementation with complete backend structure, normalized schema, and multi-role frontend modules.

## 2) Problem Statement
Traditional blood coordination often depends on manual calls, fragmented records, and delayed matching, causing:
- slow emergency response
- low donor engagement continuity
- weak traceability of request lifecycle
- poor inventory decision visibility

## 3) Solution & USP
BloodSync delivers an end-to-end lifecycle from request creation to donation closure.

### Unique Selling Points
- Multi-role architecture: `admin`, `hospital`, `donor`, and public flows
- Strong access control using JWT + role middleware
- Compatibility-aware donor request response flow
- Camp management with registrations, attendance, and donation units
- Export/report capability for operational transparency

## 4) Value Delivered
| Stakeholder | Value |
|---|---|
| Donor | Clear opportunities, appointment management, donation history |
| Hospital | Faster request handling, stock control, donor history visibility |
| Admin | Governance, audit trails, system-level reports and actions |
| Public | Access to camps and awareness landing data |

## 5) Feature Matrix
| Feature | Public | Donor | Hospital | Admin |
|---|---:|---:|---:|---:|
| Register/Login | Yes | Yes | Yes | Yes |
| Dashboard | No | Yes | Yes | Yes |
| Request Lifecycle | No | Respond | Create/Manage | Monitor |
| Appointments | No | Book/Reschedule/Cancel | Confirm/Manage | Monitor |
| Inventory | No | No | Manage | Trends/Export |
| Camps | View | Register | Manage | Manage + Analytics |
| Notifications | No | Yes | Yes | Yes |
| Reports/Export | No | History | Stock Tx | System Reports |

## 6) System Architecture
```text
Client (Static Pages + JS Modules)
  -> Express Route Layer
    -> Middleware (Auth, Roles, Validation)
      -> Controllers (Business Rules)
        -> Models (SQL access)
          -> MySQL Database
```

### Architectural Characteristics
- Modular MVC backend (`routes -> controllers -> models`)
- Focused middleware chain for secure request handling
- Centralized error handling
- Reusable frontend JS modules for role pages

## 7) Core Workflows
### A. Emergency Blood Fulfillment
1. Hospital creates request (`blood_group`, `units`, `urgency`, `city`).
2. Donors review and respond to requests.
3. Donor books appointment slot.
4. Hospital confirms and records donation.
5. History, notifications, and logs update automatically.

### B. Donation Camp Lifecycle
1. Admin/Hospital creates camp.
2. Donors register for upcoming camps.
3. Organizer marks attendance and donation outcomes.
4. Camp metrics and records are stored for analytics.

## 8) Data Model (Implemented Tables)
### Identity & Profiles
- `users`
- `donors`
- `hospitals`

### Transactions & Operations
- `blood_requests`
- `request_responses`
- `appointments`
- `donations`
- `pre_donation_questionnaires`
- `donor_feedback`

### Inventory, Communication, Governance
- `blood_stock`
- `stock_transactions`
- `notifications`
- `announcements`
- `activity_logs`

### Camp Ecosystem
- `camps`
- `camp_registrations`
- `camp_attendance`
- `camp_donations`

## 9) Security & Reliability
- Password hashing with `bcryptjs`
- JWT-based session validation
- Role-based access enforcement
- Input validation using `express-validator`
- CORS guard with controlled origins
- Server health endpoint: `GET /api/health`

## 10) API Coverage (High Level)
### Auth/Public
- `/api/auth/*`
- `/api/public/*`

### Donor
- dashboard, request response, appointments
- questionnaire, feedback
- notifications, profile, history export
- camp register/cancel/registrations

### Hospital
- profile + dashboard
- complete blood request lifecycle
- stock upsert/adjust/trends/export
- appointments and donation confirm
- announcements and camps management

### Admin
- user governance and role/status control
- requests/history/activity visibility
- reports and stock analytics export
- camps management and camps analytics

## 11) Quick Start
1. Copy `.env.example` to `.env`
2. Configure DB values
3. Import schema:
```bash
mysql -u root -p < server/database/schema.sql
```
4. Install:
```bash
npm install
```
5. Start:
```bash
npm run dev
```
6. Open:
```text
http://localhost:5000
```

### Environment Variables
| Key | Purpose |
|---|---|
| `PORT` | API server port |
| `NODE_ENV` | Runtime environment |
| `CLIENT_URL` | CORS allowed origin |
| `JWT_SECRET` | JWT signing secret |
| `JWT_EXPIRES_IN` | Token expiry |
| `DB_HOST` / `DB_PORT` | DB host and port |
| `DB_USER` / `DB_PASSWORD` | DB credentials |
| `DB_NAME` | Database name |

## 12) UI Showcase
> Ensure `docs/screenshots/*` is committed so GitHub can render images.

### Public
![Home](docs/screenshots/index.png)
![Public Camps](docs/screenshots/camps.png)
![Login](docs/screenshots/login.png)
![Register](docs/screenshots/register.png)

### Dashboards
![Admin Dashboard](docs/screenshots/admin-dashboard.png)
![Donor Dashboard](docs/screenshots/donor-dashboard.png)
![Hospital Dashboard](docs/screenshots/hospital-dashboard.png)

### Donor Module
![Donor Appointments](docs/screenshots/donor-appointments.png)
![Donor Camps](docs/screenshots/donor-camps.png)
![Donor History](docs/screenshots/donor-history.png)
![Donor Notifications](docs/screenshots/donor-notifications.png)
![Donor Profile](docs/screenshots/donor-profile.png)
![Donor Requests](docs/screenshots/donor-requests.png)

### Hospital Module
![Hospital Analytics](docs/screenshots/hospital-analytics.png)
![Hospital Appointments](docs/screenshots/hospital-appointments.png)
![Hospital Camps](docs/screenshots/hospital-camps.png)
![Hospital Inventory](docs/screenshots/hospital-inventory.png)
![Hospital Profile](docs/screenshots/hospital-profile.png)
![Hospital Requests](docs/screenshots/hospital-requests.png)

### Admin Module
![Admin Camps](docs/screenshots/admin-camps.png)
![Admin Users](docs/screenshots/admin-users.png)

## 13) Demo Credentials
- Admin: `admin@bloodsync.com` / `Password@123`
- Donor: `donor1@mail.com` / `Password@123`
- Hospital: `hosp1@mail.com` / `Password@123`

## 14) Presentation-Ready Pitch Points
- Real-world impact: shortens coordination cycle in critical blood demand scenarios
- Complete lifecycle handling from request generation to donation completion
- Strong engineering discipline through MVC separation and schema-backed design
- Scalable foundation for geolocation matching, automated alerts, and predictive analytics

## 15) Future Enhancements
- Geo-distance based donor prioritization
- SMS/Email/WhatsApp alert integrations
- Forecasting and shortage prediction models
- CI/CD pipeline with automated test coverage
- Containerized deployment
