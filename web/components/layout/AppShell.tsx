import { ReactNode } from 'react'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { RightPanel } from '@/components/layout/RightPanel'
import { MobileDock } from '@/components/layout/MobileDock'
import { CommandPalette } from '@/components/command/CommandPalette'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="app-shell">
        {/* Header: spans full width, row 1 */}
        <header className="app-shell-header">
          <Header />
        </header>

        {/* Sidebar: left column, row 2 */}
        <aside className="app-shell-sidebar">
          <Sidebar />
        </aside>

        {/* Main content: center column, row 2 */}
        <main className="app-shell-main">
          <div className="app-shell-content">
            {children}
          </div>
        </main>

        {/* Right Panel: right column, row 2 */}
        <aside className="app-shell-panel" data-visible="false">
          <RightPanel />
        </aside>

        {/* Mobile Dock: fixed position, visible only on mobile via CSS */}
        <MobileDock />
      </div>

      {/* Command Palette: portal-based overlay, renders at root level */}
      <CommandPalette />
    </>
  )
}
