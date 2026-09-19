$content = [System.IO.File]::ReadAllText("C:\Users\ANIM\yard\app\admin\page.tsx", [System.Text.Encoding]::UTF8)

# 1. Update sidebar width from 280px to 260px
$content = $content -replace 'w-\[280px\]', 'w-[260px]'

# 2. Update SectionKey type to include Settings
$content = $content -replace 'type SectionKey = "Overview" \| "Reports" \| "Payouts" \| "Users" \| "Posts" \| "Battles"', 'type SectionKey = "Overview" | "Reports" | "Payouts" | "Users" | "Posts" | "Battles" | "Settings"'

# 3. Add Settings group to NAV_GROUPS
$idx = $content.IndexOf('{ label: "Engagement"')
if ($idx -ge 0) {
    $endIdx = $content.IndexOf('],', $idx)
    if ($endIdx -ge 0) {
        $insertPos = $endIdx + 1
        $newGroup = "
  { label: "Settings", items: [{ key: "Settings", label: "Settings", icon: "⚙", desc: "Keys & config" }] },"
        $content = $content.Insert($insertPos, $newGroup)
    }
}

# 4. Update NavButton component
$oldNavButton = @'
function NavButton({ active, icon, label, count, onClick, desc }: { active: boolean; icon: string; label: string; count?: number | null; onClick: () => void; desc?: string }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39] group }
    >
      <span className={w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 transition-all } aria-hidden>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold leading-none">{label}</span>
        {desc && <span className={lock text-[11px] mt-1 }>{desc}</span>}
      </span>
      {typeof count === "number" && count > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={	ext-[11px] font-bold px-2 py-1 rounded-full flex-shrink-0 }
        >{count > 99 ? "99+" : count}</motion.span>
      )}
    </button>
  )
}
'@

$newNavButton = @'
function NavButton({ active, icon, label, count, onClick, desc }: { active: boolean; icon: string; label: string; count?: number | null; onClick: () => void; desc?: string }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39] group relative }
    >
      <span className={w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 transition-all } aria-hidden>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium leading-none">{label}</span>
        {desc && <span className={lock text-[11px] mt-0.5 }>{desc}</span>}
      </span>
      {typeof count === "number" && count > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={	ext-[11px] font-bold px-2 py-1 rounded-full flex-shrink-0 }
        >{count > 99 ? "99+" : count}</motion.span>
      )}
    </button>
  )
}
'@

$content = $content.Replace($oldNavButton, $newNavButton)

[System.IO.File]::WriteAllText("C:\Users\ANIM\yard\app\admin\page.tsx", $content, [System.Text.Encoding]::UTF8)
"Done"