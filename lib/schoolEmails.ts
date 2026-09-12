export const CAMPUS_DOMAINS: Record<string, string> = {
  "st.ug.edu.gh": "University of Ghana",
  "ug.edu.gh": "University of Ghana",
  "st.knust.edu.gh": "KNUST",
  "ucc.edu.gh": "UCC",
  "live.gctu.edu.gh": "GCTU",
  "upsamail.edu.gh": "UPSA",
}

export function getCampusFromEmail(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase()
  return CAMPUS_DOMAINS[domain] || null
}