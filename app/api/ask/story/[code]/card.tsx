export function StoryCard({ ghostId, campus }: { ghostId: string; campus: string }) {
  const initial = (ghostId || "y").trim().charAt(0).toUpperCase() || "Y"
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        backgroundColor: "#050505",
        backgroundImage: "linear-gradient(180deg, rgba(186,255,57,0.16), transparent 40%)",
        padding: "120px 80px 100px",
      }}
    >
      <div style={{ display: "flex", fontSize: 56, fontWeight: 900, color: "#ffffff", letterSpacing: -2 }}>
        YARD<span style={{ color: "#baff39" }}>.</span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 90,
          width: 220,
          height: 220,
          borderRadius: 999,
          backgroundColor: "rgba(186,255,57,0.14)",
          border: "4px solid rgba(186,255,57,0.7)",
          fontSize: 110,
          fontWeight: 900,
          color: "#baff39",
        }}
      >
        {initial}
      </div>

      <div style={{ display: "flex", marginTop: 60, fontSize: 40, color: "rgba(255,255,255,0.5)" }}>
        ask anonymously
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 24,
          padding: "36px 64px",
          borderRadius: 36,
          backgroundColor: "rgba(255,255,255,0.06)",
          border: "3px solid rgba(186,255,57,0.55)",
          fontSize: 76,
          fontWeight: 900,
          color: "#ffffff",
          textAlign: "center",
        }}
      >
        ask {ghostId} anything
      </div>
      <div style={{ display: "flex", marginTop: 28, fontSize: 44, color: "#baff39" }}>{campus}</div>

      <div style={{ display: "flex", flex: 1 }} />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          borderRadius: 32,
          backgroundColor: "#baff39",
          padding: "34px 90px",
        }}
      >
        <div style={{ display: "flex", fontSize: 52, fontWeight: 900, color: "#050505" }}>send it — they will never know</div>
        <div style={{ display: "flex", marginTop: 10, fontSize: 36, color: "rgba(5,5,5,0.6)" }}>100% anonymous — yardapp.me</div>
      </div>
    </div>
  )
}
