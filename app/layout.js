import { Outfit, Inter } from 'next/font/google';
import './globals.css';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-display', weight: ['400','600','700','800'] });
const inter  = Inter({ subsets: ['latin'], variable: '--font-body',    weight: ['400','500','600','700'] });

export const metadata = {
  title: 'CineList — Your Movie & TV Watchlist',
  description: 'Discover, track, and share your favourite movies and TV shows. Powered by TMDB.',
  openGraph: {
    title: 'CineList — Movie & TV Watchlist',
    description: 'Track everything you want to watch, are watching, and have watched.',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${outfit.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
