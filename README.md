# Hungry Point - Duraha API

Express + TypeScript + MongoDB backend for ordering, POS, kitchen display, employee, attendance, salary, coupons, invoices, reviews, reports, WhatsApp messaging, and OTP auth.

## Setup

```bash
npm install
cp .env.example .env
npm run seed
npm run dev
```

API runs on `http://localhost:4000`.

Seed login:

- `superadmin@hungrypoint.local`
- OTP in development is printed in the API response and console.

## Main Endpoints

- `POST /api/auth/request-otp`
- `POST /api/auth/verify-otp`
- `GET /api/menu/categories`
- `GET /api/menu/items`
- `POST /api/orders`
- `PATCH /api/orders/:id/status`
- `GET /api/invoices/:id/pdf`
- `POST /api/whatsapp/send-invoice`
- CRUD: `/api/admin/{branches,employees,categories,items,coupons,reviews,settings}`
- Reports: `/api/reports/summary`

Socket.IO events:

- `order:new`
- `order:status`
- `invoice:created`
