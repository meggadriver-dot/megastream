# MegaStream Firestore Security Specification

## 1. Data Invariants
1. **PII Isolation**: User profile documents (`/users/{userId}`) contain email and personal preferences and are readable/writable ONLY by the owning verified user (`request.auth.uid == userId`) or an administrator (`isAdmin()`).
2. **Self-Assigned Role Prevention**: Users creating their own `/users/{userId}` document MUST set `role == 'user'`, `blocked == false`, and `plan == 'free'`. Only an administrator may promote roles, block accounts, or alter subscription tiers.
3. **Immutable Ownership & Timestamps**: `uid`, `userId`, and `createdAt` cannot be modified after creation. `createdAt` on create and `updatedAt` on update must equal `request.time`.
4. **Authorized Channels Integrity**: Public/authenticated users may read active channels in `/channels/{channelId}`, but ONLY administrators may create, update, or delete live TV channels.
5. **Subcollection Ownership**: `/users/{userId}/favorites/{favoriteId}` and `/users/{userId}/history/{historyId}` require `isValidId()`, `userId == request.auth.uid`, and strict field allowlists (`hasAll` + `hasOnly`).

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. Unauthenticated read on `/users/{userId}` -> DENIED
2. Cross-user read on `/users/otherUid` -> DENIED
3. Self-promotion on create: `/users/{uid}` with `role: 'admin'` -> DENIED
4. Shadow field injection on `/users/{uid}` with `isVerified: true` -> DENIED
5. Backdated timestamp on `/users/{uid}` create (`createdAt != request.time`) -> DENIED
6. Unverified email trying to write `/users/{uid}/favorites/{id}` -> DENIED
7. Oversized `title` (> 200 chars) on favorite creation -> DENIED
8. Invalid path variable ID (`../bad` or >128 chars) -> DENIED
9. Non-admin trying to write `/channels/{channelId}` -> DENIED
10. Non-admin trying to elevate `/subscriptions/{uid}` status to `active` -> DENIED
11. Modifying immutable `uid` on `/users/{uid}` update -> DENIED
12. Non-admin reading or writing `/admins/{adminId}` -> DENIED
