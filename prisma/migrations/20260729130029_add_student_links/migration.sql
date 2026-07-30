-- CreateTable
CREATE TABLE "StudentLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "registrarId" TEXT NOT NULL,
    "dependentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentLink_registrarId_fkey" FOREIGN KEY ("registrarId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentLink_dependentId_fkey" FOREIGN KEY ("dependentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StudentLink_registrarId_idx" ON "StudentLink"("registrarId");

-- CreateIndex
CREATE INDEX "StudentLink_dependentId_idx" ON "StudentLink"("dependentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentLink_registrarId_dependentId_key" ON "StudentLink"("registrarId", "dependentId");
