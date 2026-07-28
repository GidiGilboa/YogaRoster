/*
  Warnings:

  - Added the required column `phone` to the `Student` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Student_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- Existing rows are only the placeholder "Student A" seed data from an earlier
-- story (auto-created on signup before real student management existed) and
-- have no phone number to backfill, so they are dropped rather than copied.
DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
CREATE INDEX "Student_teacherId_idx" ON "Student"("teacherId");
CREATE UNIQUE INDEX "Student_teacherId_phone_key" ON "Student"("teacherId", "phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
