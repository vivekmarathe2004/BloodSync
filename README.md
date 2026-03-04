# BloodSync - Blood Donation Management System

Production-style college major project with modern SaaS dashboard UI.

## Tech Stack
- Frontend: HTML, CSS, Vanilla JS
- Backend: Node.js + Express (MVC)
- Database: MySQL
- Charts: Chart.js
- Auth: JWT + bcrypt

## Run
1. Copy `.env.example` to `.env` and update DB credentials.
2. Import schema: `mysql -u root -p < server/database/schema.sql`
3. Install: `npm install`
4. Start: `npm run dev`
5. Open: `http://localhost:5000`

## Project Structure
- `client/` frontend pages, reusable UI modules, shared design system CSS.
- `server/` Express MVC backend.

## API Endpoints
- `GET /api/public/landing`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/donor/dashboard`
- `POST /api/donor/requests/:requestId/respond` (accept/decline)
- `GET /api/donor/appointments`
- `POST /api/donor/appointments`
- `PATCH /api/donor/appointments/:appointmentId/reschedule`
- `PATCH /api/donor/appointments/:appointmentId/cancel`
- `GET /api/donor/notifications`
- `PATCH /api/donor/notifications/:notificationId/read`
- `PATCH /api/donor/profile`
- `GET /api/donor/history/export`
- `GET /api/donor/certificate/:donationId`
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
- `GET /api/admin/dashboard`
- `DELETE /api/admin/users/:id`
- `PATCH /api/admin/users/:id/status` (ban/unban)
- `GET /api/admin/requests`
- `GET /api/admin/history`
- `GET /api/admin/activity`
- `GET /api/admin/reports/export`
- `POST /api/admin/announcements`

## Demo Credentials (seeded)
- Admin: `admin@bloodsync.com` / `Password@123`
- Donor: `donor1@mail.com` / `Password@123`
- Hospital: `hosp1@mail.com` / `Password@123`
