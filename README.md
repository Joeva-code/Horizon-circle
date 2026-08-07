# EventConnect API

Backend API for the EventConnect planner and vendor marketplace.

## Frontend integration

The deployed frontend currently calls `POST /api/auth/register`. The API keeps
this as a compatibility alias for `POST /api/auth/signup`.

Registration accepts these account values and stores only the canonical role:

| Client value | Stored role |
| --- | --- |
| `planner`, `organizer` | `PLANNER` |
| `vendor`, `vmendor` | `VENDOR` |

All registration requests must include `termsAccepted: true`. This is deliberate:
the frontend needs to send an explicit acceptance rather than the server assuming
consent from a checkbox such as “Remember me”.

Set `CORS_ORIGIN` to a comma-separated list of browser origins before deploying,
for example:

```env
CORS_ORIGIN=http://localhost:5173,https://orange-herizon-circle-a7pj-delta.vercel.app
```

## Booking flow

Use the booking endpoints when a planner wants to send a booking request directly
to a vendor and the vendor needs to receive/respond to it.

All requests require `Authorization: Bearer <token>`.

| Actor | Method and path | Purpose |
| --- | --- | --- |
| Planner | `POST /api/bookings` | Send a booking request to a vendor |
| Planner | `GET /api/bookings/planner` | See bookings the planner sent |
| Vendor | `GET /api/bookings/vendor` | See bookings the vendor received |
| Vendor | `POST /api/bookings/:id/accept` | Accept a booking request |
| Vendor | `POST /api/bookings/:id/decline` | Decline a booking request |

Create a booking directly from a vendor:

```json
{
  "vendorId": "vendor-user-id",
  "eventType": "Wedding",
  "eventDate": "2026-10-12",
  "eventLocation": "Lagos",
  "guestCount": 120,
  "budget": 500000,
  "specialNotes": "Outdoor ceremony"
}
```

Or turn an existing enquiry into a booking request:

```json
{
  "enquiryId": "existing-enquiry-id"
}
```
