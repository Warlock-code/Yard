import { createUploadthing, type FileRouter } from "uploadthing/next"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getEffectiveStorageLimitMB } from "@/lib/tier"

const f = createUploadthing()

const authMiddleware = async ({ req }: { req: Request }) => {
  const cookie = req.headers.get("cookie") || ""
  const token = cookie.split("; ").find((c) => c.startsWith("yard_token="))?.split("=")[1]
  if (!token) throw new Error("Unauthorized")
  const user = await getCurrentUser(token)
  if (!user) throw new Error("Unauthorized")
  return { userId: user.id, storageLimit: getEffectiveStorageLimitMB(user), storageUsed: user.storageUsed }
}

export const ourFileRouter = {
  postImage: f({ image: { maxFileSize: "4MB" } })
    .middleware(authMiddleware)
    .onUploadComplete(async ({ file, metadata }) => {
      const { userId, storageLimit, storageUsed } = metadata
      const sizeMB = file.size / (1024 * 1024)
      if (storageUsed + sizeMB > storageLimit) {
        throw new Error("Storage limit exceeded")
      }
      await prisma.mediaUpload.create({
        data: {
          fileKey: file.key,
          url: file.ufsUrl,
          sizeBytes: file.size,
          userId,
          status: "active",
        },
      })
      await prisma.user.update({
        where: { id: userId },
        data: { storageUsed: { increment: sizeMB } },
      })
      return { url: file.ufsUrl }
    }),
} satisfies FileRouter


export type OurFileRouter = typeof ourFileRouter