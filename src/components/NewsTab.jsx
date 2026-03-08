import React, { useState, useEffect } from 'react';

export default function NewsTab({ ticker }) {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/news/${ticker}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch news');
                return res.json();
            })
            .then(data => {
                setNews(data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, [ticker]);

    if (loading) return <div className="tab-loading-spinner"><div className="spinner"></div><p>Loading recent news...</p></div>;
    if (error) return <div className="tab-error">Unable to load news: {error}</div>;
    if (news.length === 0) return <div className="no-data">No recent news available for {ticker}.</div>;

    return (
        <div className="news-tab">
            <div className="section-card">
                <h3>Recent Headlines</h3>
                <div className="news-list">
                    {news.map(item => (
                        <a key={item.uuid} href={item.link} target="_blank" rel="noopener noreferrer" className="news-item">
                            <div className="news-content">
                                <h4>{item.title}</h4>
                                <div className="news-meta">
                                    <span className="news-publisher">{item.publisher}</span>
                                    {item.providerPublishTime && (
                                        <span className="news-time">
                                            {/* Convert seconds to readable date/time relatively if recent, else absolute */}
                                            {formatNewsDate(item.providerPublishTime)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
}

function formatNewsDate(timestampSeconds) {
    const d = new Date(timestampSeconds * 1000);
    const diff = (new Date() - d) / 1000;

    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
    return d.toLocaleDateString();
}
