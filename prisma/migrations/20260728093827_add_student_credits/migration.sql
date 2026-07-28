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
    "credits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Student_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Student" ("createdAt", "email", "firstName", "id", "lastName", "phone", "teacherId") SELECT "createdAt", "email", "firstName", "id", "lastName", "phone", "teacherId" FROM "Student";
DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
CREATE INDEX "Student_teacherId_idx" ON "Student"("teacherId");
CREATE UNIQUE INDEX "Student_teacherId_phone_key" ON "Student"("teacherId", "phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
