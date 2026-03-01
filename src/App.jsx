import { useState } from 'react';
import SearchBar from './components/SearchBar';
import StockDashboard from './components/StockDashboard';

function App() {
    const [selectedTicker, setSelectedTicker] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSelectTicker = (ticker) => {
        setSelectedTicker(ticker);
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
                        <span className="logo-icon">◈</span>
                        <h1>StockLens</h1>
                    </div>
                    <p className="tagline">AI-Powered Fair Value Analysis</p>
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
                    </div>
                ) : (
                    <StockDashboard
                        ticker={selectedTicker}
                        onBack={handleBack}
                    />
                )}
            </main>

            <footer className="app-footer">
                <p>Data provided by Yahoo Finance. For informational purposes only — not financial advice.</p>
            </footer>
        </div>
    );
}

export default App;
