# 13 — Authentication Specification

This is a private single-user application.

## Initial approach

Strong password + server-side session cookie is sufficient. Passkey support can be added later.

Session requirements:

- HttpOnly
- Secure in production
- Appropriate SameSite setting
- Controlled lifetime
- Server-side validation

Password requirements:

- Modern password hash
- Never plaintext
- Login rate limiting

Every private library API and page endpoint requires authentication.

Never put database credentials, source credentials, session secrets, or API keys into client bundles.
