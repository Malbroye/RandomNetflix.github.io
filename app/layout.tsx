import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Netflix Roulette',
  description: 'by Malbroye',
  generator: 'MALBROYE STUDIO',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  console.log(`

• ▌ ▄ ·.  ▄▄▄· ▄▄▌  ▄▄▄▄· ▄▄▄         ▄· ▄▌▄▄▄ .
·██ ▐███▪▐█ ▀█ ██•  ▐█ ▀█▪▀▄ █·▪     ▐█▪██▌▀▄.▀·
▐█ ▌▐▌▐█·▄█▀▀█ ██▪  ▐█▀▀█▄▐▀▀▄  ▄█▀▄ ▐█▌▐█▪▐▀▀▪▄
██ ██▌▐█▌▐█ ▪▐▌▐█▌▐▌██▄▪▐█▐█•█▌▐█▌.▐▌ ▐█▀·.▐█▄▄▌
▀▀  █▪▀▀▀ ▀  ▀ .▀▀▀ ·▀▀▀▀ .▀  ▀ ▀█▄▀▪  ▀ •  ▀▀▀ 
by Malbroye Studio
Welcome to Netflix Roulette!  
Enjoy the show! 🎬🍿
  `)

  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}