import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: {
        default: 'PulsePeak',
        template: '%s | PulsePeak',
    },
    description: 'Ton coach cycliste intelligent. Planification personnalisée, analyse de performance et suivi de forme pour progresser.',
    applicationName: 'PulsePeak',
    keywords: ['cyclisme', 'entraînement', 'coach', 'vélo', 'triathlon', 'running', 'performance', 'TSS', 'CTL'],
    authors: [{ name: 'PulsePeak' }],
    creator: 'PulsePeak',
    robots: { index: false, follow: false },
    openGraph: {
        type: 'website',
        locale: 'fr_FR',
        title: 'PulsePeak — Coach cycliste intelligent',
        description: 'Planification personnalisée, analyse de performance et suivi de forme pour progresser.',
        siteName: 'PulsePeak',
    },
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'PulsePeak',
    },
};

export const viewport: Viewport = {
    themeColor: '#020617',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="fr">
            <body className={inter.className}>
                <div className="min-h-screen">
                    {children}
                </div>
            </body>
        </html>
    );
}