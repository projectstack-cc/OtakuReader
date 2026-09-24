# 20 — Security Checklist

## Authentication

- [ ] Strong password/passkey
- [ ] Secure password hash
- [ ] Secure session cookie
- [ ] Login rate limiting
- [ ] Logout invalidates session

## Network

- [ ] HTTPS
- [ ] Correct reverse proxy configuration
- [ ] No unnecessary exposed ports
- [ ] Private endpoints authenticated

## Storage

- [ ] Path traversal prevented
- [ ] Source filenames sanitized
- [ ] Imported archives validated
- [ ] Temporary files isolated
- [ ] No arbitrary filesystem access

## Database

- [ ] Parameterized queries/ORM
- [ ] Foreign keys enabled
- [ ] Migrations tracked
- [ ] Backups available
- [ ] No secrets in logs

## Application

- [ ] Request validation
- [ ] Errors do not expose filesystem paths
- [ ] Secrets never shipped to browser
- [ ] Dependency audit
- [ ] Production debug disabled

## Source adapters

- [ ] Credentials stay server-side
- [ ] Rate limits respected
- [ ] No DRM/access-control bypass
- [ ] Safe archive extraction
- [ ] Source failures cannot corrupt library state
