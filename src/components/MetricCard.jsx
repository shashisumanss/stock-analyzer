export default function MetricCard({ label, value, subtitle, trend, icon, className = '' }) {
    const getTrendClass = () => {
        if (!trend) return '';
        if (trend > 0) return 'trend-up';
        if (trend < 0) return 'trend-down';
        return 'trend-neutral';
    };

    const getTrendIcon = () => {
        if (!trend) return null;
        if (trend > 0) return '▲';
        if (trend < 0) return '▼';
        return '●';
    };

    return (
        <div className={`metric-card ${className}`}>
            <div className="metric-header">
                {icon && <span className="metric-icon">{icon}</span>}
                <span className="metric-label">{label}</span>
            </div>
            <div className="metric-value-row">
                <span className="metric-value">{value}</span>
                {trend !== undefined && trend !== null && (
                    <span className={`metric-trend ${getTrendClass()}`}>
                        {getTrendIcon()} {Math.abs(trend).toFixed(2)}%
                    </span>
                )}
            </div>
            {subtitle && <span className="metric-subtitle">{subtitle}</span>}
        </div>
    );
}
