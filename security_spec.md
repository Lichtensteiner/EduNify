# Security Specification for Grades

## Data Invariants
1. A grade must always be associated with a valid student (exists in `users`).
2. A grade must always have a `teacherId` matching the creator.
3. A teacher can ONLY manage (create/update/delete) grades for subjects they are authorized to teach.
4. A teacher can ONLY modify or delete grades they themselves created (unless they are an admin).
5. Crucial fields like `studentId`, `subject`, and `teacherId` are immutable for teachers after creation.

## The Dirty Dozen Payloads

| # | Attack | Description | Expected Outcome |
|---|---|---|---|
| 1 | Identity Spoofing | Create grade with `teacherId` set to another user. | PERMISSION_DENIED |
| 2 | Cross-Subject Creation | IT Teacher creating a "History-Geo" grade. | PERMISSION_DENIED |
| 3 | Cross-Teacher Update | IT Teacher A updating a grade created by IT Teacher B. | PERMISSION_DENIED |
| 4 | Subject Poisoning | Update existing IT grade's subject to "Math". | PERMISSION_DENIED |
| 5 | Student Hijacking | Update existing grade to point to a different `studentId`. | PERMISSION_DENIED |
| 6 | Ghost Field Injection | Adding `isVerified: true` to a grade payload. | PERMISSION_DENIED |
| 7 | ID Poisoning | Using a massive string as `gradeId`. | PERMISSION_DENIED |
| 8 | Orphaned Grade | Creating a grade for a `studentId` that does not exist. | PERMISSION_DENIED |
| 9 | Role Escalation | Teacher updating their own profile to become `role: 'admin'`. | PERMISSION_DENIED |
| 10 | Blanket Read Leak | Student listing all grades without filtering by `studentId`. | PERMISSION_DENIED |
| 11 | Unauthorized Deletion | Teacher A deleting Teacher B's grade in the same subject. | PERMISSION_DENIED |
| 12 | Temporal Fakeout | Sending a client-side `updatedAt` timestamp. | PERMISSION_DENIED |
