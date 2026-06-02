import type { Metadata } from 'next';
import { Poppins, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import 'primeicons/primeicons.css';
import 'primereact/resources/primereact.min.css';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/components/shared/ThemeProvider';
import { PrimeProvider } from '@/components/shared/PrimeProvider';

const poppins = Poppins({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});
const jakartaSans = Plus_Jakarta_Sans({
  variable: '--font-heading',
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Bardbox Studio',
  description: 'Content operations & workload management for creative teams',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${poppins.variable} ${jakartaSans.variable} font-sans antialiased`}>
        <ThemeProvider>
          <PrimeProvider>
            <TooltipProvider>
              {children}
              <Toaster richColors position="top-right" />
            </TooltipProvider>
          </PrimeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
