-- AlterTable
ALTER TABLE "User" ALTER COLUMN "storageUsed" SET DEFAULT 0,
ALTER COLUMN "storageUsed" SET DATA TYPE DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "MediaUpload" (
    "id" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaUpload_fileKey_key" ON "MediaUpload"("fileKey");

-- CreateIndex
CREATE UNIQUE INDEX "MediaUpload_url_key" ON "MediaUpload"("url");

-- CreateIndex
CREATE UNIQUE INDEX "MediaUpload_postId_key" ON "MediaUpload"("postId");

-- CreateIndex
CREATE INDEX "MediaUpload_userId_status_idx" ON "MediaUpload"("userId", "status");

-- AddForeignKey
ALTER TABLE "MediaUpload" ADD CONSTRAINT "MediaUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaUpload" ADD CONSTRAINT "MediaUpload_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
