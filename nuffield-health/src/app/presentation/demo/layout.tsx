export default function DemoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" id="demo-scroller">
      {children}
    </div>
  )
}
