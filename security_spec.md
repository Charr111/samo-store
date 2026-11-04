# SAMO Firestore Security Specification (Phase 0 - Phase 5 Audit)

## 1. Data Invariants
1. **Default-Deny Catch-All**: No unlisted collection or subcollection is ever readable or writable (`match /{document=**} { allow read, write: if false; }`).
2. **Verified Admin Identity**: Administrative operations (`categories`, `products`, `materials` mutations, `orders` read/accept/reject, and `admins` directory management) require an authenticated user with `request.auth.token.email_verified == true` whose email is either bootstrapped (`apolokor@gmail.com`, `charbelkorab11123@gmail.com`) or exists in `/admins/$(request.auth.token.email)`.
3. **PII Isolation on Orders**: Customer orders (`/orders/{orderId}`) contain PII (`customerName`, `customerEmail`, `customerPhone`, `shippingLocation`). Storefront buyers can only `create` orders in `'pending'` status with exact server timestamps (`request.time`). Reading (`get`, `list`), updating (`status` transition to `'accepted'` or `'rejected'`), and deleting orders are strictly restricted to `isAdmin()`.
4. **Strict Schema & Volumetric Bounds**: Every string field enforces `.size()` limits, every array enforces `.size() <= MAX` plus element type validation, and every create/update operation enforces `hasAll()` and `hasOnly()` key guards.
5. **Temporal Integrity & Immutability**: `createdAt` must equal `request.time` on creation and remain immutable (`incoming().createdAt == existing().createdAt`) on update. `updatedAt` must equal `request.time` on update.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on Product Create**: `{ ..., "isSuperFeatured": true }` -> Rejected by `data.keys().hasOnly(...)`.
2. **Unverified Admin Email Spoof**: Token with `email: "apolokor@gmail.com"` and `email_verified: false` attempting `create` on `/products/prod-1` -> Rejected by `isSignedIn()` requiring `email_verified == true`.
3. **Order PII Scraping via List**: Anonymous or non-admin signed-in user calling `list` on `/orders` -> Rejected by `isAdmin()` check on `/orders`.
4. **Pre-Accepted Order Creation**: Storefront customer submitting `status: "accepted"` on `/orders/ord-1` -> Rejected by `incoming().status == 'pending'`.
5. **Price Math Manipulation on Order**: Submitting `subtotal: 500, deliveryFee: 25, totalPrice: 1` -> Rejected by `data.totalPrice == data.subtotal + data.deliveryFee`.
6. **ID Poisoning Attack**: Creating `/products/bad$id!with*spaces` or a 500-char ID -> Rejected by `isValidId(productId)`.
7. **Timestamp Forgery**: Submitting past/future `createdAt` on `/orders/ord-2` -> Rejected by `incoming().createdAt == request.time`.
8. **Immutable Field Mutation**: Admin updating `createdAt` or `orderNumber` on an existing order -> Rejected by `incoming().createdAt == existing().createdAt` and `affectedKeys().hasOnly(['status', 'updatedAt'])`.
9. **Value Poisoning on Order Status Update**: Admin updating `status` to `"shipped_free"` or a 1MB string -> Rejected by `isValidOrder(incoming())` which enforces `data.status in ['pending', 'accepted', 'rejected']`.
10. **Array Overflow on Product Sizes**: Admin submitting 50 sizes in `sizes` array -> Rejected by `data.sizes.size() <= 16`.
11. **Self-Privilege Escalation on `/admins`**: Non-admin user creating `/admins/attacker@gmail.com` -> Rejected by `isAdmin()`.
12. **Admin Attribution Forgery**: Admin creating `/admins/new@gmail.com` with `addedBy: "someone_else@gmail.com"` -> Rejected by `incoming().addedBy == request.auth.token.email`.

## 3. Red Team Audit Conflict Report
- `categories`: Protected against Shadow Update (`hasOnly`), Email Spoofing (`email_verified == true`), ID Poisoning (`isValidId`), and Query Trust (`resource.data.department in ['women', 'kids']`).
- `products`: Protected against Shadow Update (`hasOnly`), Array Overflow (`galleryUrls.size() <= 8`, `sizes.size() <= 16`, `materials.size() <= 12`), and Value Poisoning (`isValidProduct(incoming())` wraps `allow update`).
- `materials`: Protected against Shadow Update and arbitrary mutations (`allow update: if false`).
- `orders`: Protected against PII leakage (only `isAdmin()` can `get`/`list`), math tampering (`totalPrice == subtotal + deliveryFee`), and state shortcutting (`affectedKeys().hasOnly(['status', 'updatedAt'])`).
- `admins`: Protected against privilege escalation (`isAdmin()` required for all operations, `incoming().email == adminId`).
