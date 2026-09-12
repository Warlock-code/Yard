export async function moderateWithAI(postText: string, reportReason: string) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "anthropic/claude-3.5-haiku", // fast + cheap, good for this
      messages: [
        {
          role: "system",
          content:
            "You moderate an anonymous campus social app that allows free speech, insults, and roasting. Only flag content that is: a genuine threat of violence, doxxing (real names/addresses/contact info), child sexual abuse material, or content facilitating a crime. Insults, drama, and offensive opinions are NOT violations. Respond with only one word: SAFE, REVIEW, or VIOLATION.",
        },
        { role: "user", content: `Post: "${postText}"\nReport reason: "${reportReason}"` },
      ],
    }),
  })
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || "REVIEW"
}