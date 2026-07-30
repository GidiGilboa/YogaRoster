-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Teacher" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "appName" TEXT NOT NULL DEFAULT 'Yoga Roster',
    "defaultLessonCapacity" INTEGER NOT NULL DEFAULT 10,
    "defaultLessonDuration" INTEGER NOT NULL DEFAULT 60,
    "backgroundImageUrl" TEXT,
    "isDisabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Teacher" ("appName", "backgroundImageUrl", "createdAt", "defaultLessonCapacity", "defaultLessonDuration", "email", "id", "name", "passwordHash", "phone") SELECT "appName", "backgroundImageUrl", "createdAt", "defaultLessonCapacity", "defaultLessonDuration", "email", "id", "name", "passwordHash", "phone" FROM "Teacher";
DROP TABLE "Teacher";
ALTER TABLE "new_Teacher" RENAME TO "Teacher";
CREATE UNIQUE INDEX "Teacher_email_key" ON "Teacher"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
