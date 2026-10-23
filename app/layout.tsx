import './globals.css';
import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'إذاعة القرآن الكريم — البث المباشر والتسجيل الصوتي',
  description: 'استمع إلى البث المباشر لإذاعة القرآن الكريم من القاهرة ومكة المكرمة مع مواقيت الصلاة وتسجيل التلاوات الخاشعة بجودة عالية.',
  icons: {
    icon: '/favicon.ico',
    apple: '/Logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="font-sans min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
