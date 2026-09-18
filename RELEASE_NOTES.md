# Yard Release Notes

## v1.1.0 - Security & Stability Release (September 2026)

### Critical Fixes
- **Image Upload Security**: Added authentication middleware to UploadThing, MediaUpload record creation, and storage quota enforcement
- **Payment Fulfilment**: Centralized all Paystack fulfilment in webhook handler; added atomic claim to prevent double-delivery of boosts, cosmetics, storage, streak items, boost credits, and custom names
- **Admin Moderation**: Fixed "Remove Post" bug that caused errors after cascade deletion
- **Battle System**: Enforced same-campus access, one entry per user, active prompt validation, no self-voting, no voting after battle end, idempotent earnings
- **Payout System**: Added atomic processing claim, deterministic provider transfer reference, webhook reconciliation to prevent double-transfers

### Security Improvements
- **Rate Limiting**: Replaced in-memory rate limiter with database-backed (Prisma) implementation with TTL cleanup
- **CSRF/Origin Defense**: Added origin/referer validation against allowlist for all cookie-authenticated mutations
- **Account Deletion**: Implemented authenticated account deletion with password confirmation, rate limiting, and session invalidation
- **Account Status**: Added SUSPENDED/BANNED states replacing destructive delete for admin actions; device tokens cleared on suspend/ban
- **Payout Encryption**: Bank account details encrypted at rest (AES-256-CBC); validation for Ghana account formats; masked display
- **Keystore Protection**: Removed Android signing keystore from Git history; added to .gitignore

### Features
- **Push Notifications**: Web Push subscription on notifications page; VAPID key support; FCM token registration endpoint
- **Return Reminder Cron**: Scheduled daily at 9 AM to notify inactive users
- **Feed Ranking**: Verified "For You" (school posts from campus, ranked), "Program" (program posts), "Following" (followed users), "All" (other schools)
- **Poll Type Removed**: Cleaned up unused poll post type/options from schema and API

### Compliance & Legal
- **Privacy Policy Updated**: Added disclosures for push tokens, payment/bank data, UploadThing storage, OpenRouter AI moderation, cookies, account deletion flow, public profile scope
- **Robots.txt**: Added with appropriate disallow rules for private routes
- **Sitemap.xml**: Auto-generated for public pages
- **PWA Manifest**: Added with icons for installability

### Infrastructure
- **Next.js Config**: Added image domain allowlist for UploadThing; enabled static export for Capacitor Android build
- **Capacitor Config**: Fixed webDir to `out`; added www.yardapp.me to allowNavigation; removed keystore from build options

---

## Upcoming (v1.2.0)
- Android deep-link handling for push notifications
- Release signing configuration for Play Store
- Monitoring/error reporting (Sentry/LogRocket)
- Database backup verification
- Full integration test suite