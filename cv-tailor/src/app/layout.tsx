import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CV Tailor — AI-Powered CV Customisation',
  description: 'Upload your CV, paste a job description, get a tailored CV instantly.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
