import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: '4DPF CRM',
  description: 'System zarządzania dla 4DPF — sprzedaż emulatorów DPF/DEF',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // Hardcoded dark mode — className="dark" dla bibliotek korzystających z dark: wariantów
    <html
      lang="pl"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full`}
    >
      <body className="h-full">{children}</body>
    </html>
  )
}
