// Instant boot splash: pure server component, zero JS, zero fetches.
// Shows during the `/` auth redirect so cold open never paints blank white.
export default function RootLoading() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#050505",
        color: "#f5f5f5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <p style={{ fontWeight: 900, fontSize: "28px", letterSpacing: "-0.02em" }}>
          YARD<span style={{ color: "#baff39" }}>.</span>
        </p>
        <p style={{ marginTop: "12px", fontSize: "13px", color: "rgba(255,255,255,0.40)" }}>
          waking up the yard…
        </p>
      </div>
    </main>
  )
}
