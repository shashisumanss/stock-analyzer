import { useState } from 'react';
import SearchBar from './components/SearchBar';
import StockDashboard from './components/StockDashboard';
import SectorScreener from './components/SectorScreener';
import AdBanner from './components/AdBanner';

function ClyvantaLogo({ size = 28 }) {
    return (
        <svg width={size} height={size} viewBox="21 -3 219 233" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="logo-g1" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop stopColor="#00D4FF" />
                    <stop offset="0.5" stopColor="#0099CC" />
                    <stop offset="1" stopColor="#0066FF" />
                </linearGradient>
                <linearGradient id="logo-g2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop stopColor="#FF6B35" />
                    <stop offset="1" stopColor="#F7931E" />
                </linearGradient>
            </defs>
            <path d="M197 66.85C144 13.85 37.5 13.85 37.5 120.35C37.5 226.85 144 226.85 197 173.85" stroke="url(#logo-g1)" strokeWidth="32" strokeLinecap="round" />
            <path d="M224 93.35C197 66.85 170.5 66.85 144 93.35" stroke="url(#logo-g2)" strokeWidth="16" strokeLinecap="round" />
            <path d="M224 147.35C197 173.85 170.5 173.85 144 147.35" stroke="url(#logo-g2)" strokeWidth="16" strokeLinecap="round" />
        </svg>
    );
}

function App() {
    const [selectedTicker, setSelectedTicker] = useState(null);

    const handleSelectTicker = (ticker) => {
        setSelectedTicker(ticker);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleBack = () => {
        setSelectedTicker(null);
    };

    return (
        <div className="app">
            <div className="app-bg" />
            <header className="app-header">
                <div className="header-content">
                    <div className="logo" onClick={handleBack} style={{ cursor: 'pointer' }}>
                        <ClyvantaLogo size={30} />
                        <h1>Clyvanta StockLens</h1>
                    </div>
                    <p className="tagline">AI-Powered Stock Analysis</p>
                </div>
            </header>

            <main className="app-main">
                {!selectedTicker ? (
                    <div className="search-view">
                        <div className="hero-section">
                            <h2 className="hero-title">
                                Analyze Any Stock.<br />
                                <span className="gradient-text">Know Its True Value.</span>
                            </h2>
                            <p className="hero-subtitle">
                                Enter a ticker symbol to get comprehensive financial analysis, fair value calculations, and AI-powered insights.
                            </p>
                        </div>
                        <SearchBar onSelect={handleSelectTicker} />

                        {/* Top Ad Banner */}
                        <div className="max-w-4xl mx-auto w-full px-4">
                            <AdBanner dataAdSlot="6273849102" />
                        </div>

                        {/* Sector Screener */}
                        <SectorScreener onSelectTicker={handleSelectTicker} />
                    </div>
                ) : (
                    <StockDashboard
                        ticker={selectedTicker}
                        onBack={handleBack}
                    />
                )}
            </main>

            <footer className="app-footer">
                <p>Powered by Clyvanta StockLens · Data from Yahoo Finance (delayed ~15 min) · For informational purposes only — not financial advice.</p>
            </footer>
        </div>
    );
}

export default App;
