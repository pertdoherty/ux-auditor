import './globals.css';

export const metadata = {
  title: 'UX Auditor — AI-Driven UX Testing',
  description: 'Automated UX audit tool powered by AI. Analyze any website for usability, accessibility, performance, and design quality.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
