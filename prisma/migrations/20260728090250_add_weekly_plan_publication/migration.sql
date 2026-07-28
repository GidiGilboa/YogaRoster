-- CreateTable
CREATE TABLE "WeeklyPlanPublication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "weekStart" DATETIME NOT NULL,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeeklyPlanPublication_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyPlanPublication_teacherId_weekStart_key" ON "WeeklyPlanPublication"("teacherId", "weekStart");
