import { createUploadthing, type FileRouter } from "uploadthing/next"
import { prisma } from "@/lib/prisma"

const f = createUploadthing()

export const ourFileRouter = {
  postImage: f({ image: { maxFileSize: "4MB" } }).onUploadComplete(async ({ file }) => {
    await prisma.mediaUpload.deleteMany({ where: { fileKey: file.key } })
    return { url: file.ufsUrl }
  }),
} satisfies FileRouter


export type OurFileRouter = typeof ourFileRouter