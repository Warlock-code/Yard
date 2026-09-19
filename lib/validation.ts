import { z } from "zod"

export const signupSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password too long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  programLevel: z.string().trim().min(1, "Program level is required").max(50, "Program level too long"),
  program: z.string().trim().min(1, "Program is required").max(100, "Program too long"),
})

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
})

export const postSchema = z.object({
  text: z.string().max(2000, "Post text must be 2000 characters or fewer").optional().nullable(),
  imageUrl: z.string().url("Invalid image URL").max(2048, "Image URL too long").optional().nullable(),
  type: z.enum(["confession", "gossip", "meme", "voice"]).optional(),
  visibility: z.enum(["school", "program"]).optional(),
})

export const commentSchema = z.object({
  text: z.string().min(1, "Comment cannot be empty").max(2000, "Comment too long"),
  parentId: z.string().optional(),
})

export const voteSchema = z.object({
  entryId: z.string().optional(),
  postId: z.string().optional(),
}).refine(data => data.entryId || data.postId, "Either entryId or postId required")

export const reportSchema = z.object({
  postId: z.string().optional(),
  reason: z.string().min(1, "Reason required").max(500, "Reason too long"),
})

export const adminActionSchema = z.object({
  decision: z.enum(["actioned", "dismissed"]),
})

export const payoutRequestSchema = z.object({
  amount: z.number().int().positive("Amount must be positive"),
  bankCode: z.string().min(1, "Bank code required"),
  accountNumber: z.string().min(1, "Account number required"),
  accountName: z.string().min(1, "Account name required"),
})

export const verifyEmailSchema = z.object({
  code: z.string().trim().length(6, "Code must be 6 digits").regex(/^\d{6}$/, "Code must be 6 digits"),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password too long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
})

export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data)
  if (!result.success) {
    return { success: false, error: result.error.issues.map((e) => e.message).join(", ") }
  }
  return { success: true, data: result.data }
}