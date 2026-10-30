# Global Logistics Delivery Company

A responsive courier website with public shipment tracking and a password-protected admin portal.

## Included features
- Customer tracking lookup using a unique tracking code.
- Admin sign-in at `/admin`.
- Create shipments and automatically generate a tracking code, or enter a custom code.
- Update shipment status, expected delivery date and customer-facing notes.
- View, edit, copy tracking codes and delete shipment records.
- SQLite database stored in `data/`.
- Password is read from server environment variables, not browser JavaScript.
- Login rate limiting and secure, HTTP-only session cookies.

## Initial administrator login

- Username: `admin`
- Password: `GLD-ls2j1dziACKJb-Bt`

**Keep this password private. Change it before inviting anyone else to administer the site.** The `.env` file contains the password and session secret. It is excluded from Git by `.gitignore`. Do not upload `.env` to a public GitHub repository or share it.

## Run locally
Requires Node.js 20 or newer.

1. Extract this folder.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Run `npm start`.
5. Visit `http://localhost:3000` for the customer site.
6. Visit `http://localhost:3000/admin` for the admin panel.

## Deploy online
This is a full-stack Node.js app; GitHub Pages alone cannot run its server or database.

Use a Node.js hosting provider (for example, Render or Railway) and configure:
- Build command: `npm install`
- Start command: `npm start`
- Environment variables: copy `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `SESSION_SECRET` from your local `.env` into the hosting provider's private environment-variable settings. Also set `NODE_ENV=production`.

**Persistent storage is required.** Mount a persistent disk/volume and set the app's working directory or database path to a persistent location before using it for real shipments. The starter app currently stores SQLite at `data/shipments.sqlite` inside the project directory. On Render, for example, mount a persistent disk at the app's `data` directory. Without persistent storage, shipments may be lost when the host restarts or redeploys.

Use HTTPS in production. Keep `.env` out of GitHub. Back up the SQLite database regularly.

## Customer contact details
- WhatsApp: +44 7348 537011
- Email: globallogistic@fastservice.com

## Shipment statuses
Shipment registered · Picked up · In transit · Arrived at sorting facility · Customs clearance · Out for delivery · Delivered · Delivery exception

## Before public launch
- Confirm the company has permission to use the supplied contact details and business name.
- Configure a persistent database volume and HTTPS.
- Replace the initial admin password with a unique password.
- Test admin login, shipment creation, customer tracking and status updates.
- Add a privacy notice and terms appropriate to the countries where the service operates.

This is a starter implementation. It does not connect to courier carrier networks, automatically calculate shipping prices, process payments, or send email/SMS notifications.
