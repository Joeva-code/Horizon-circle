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
