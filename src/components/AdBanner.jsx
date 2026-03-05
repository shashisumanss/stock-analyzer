import React, { useEffect } from 'react';

const AdBanner = ({ dataAdSlot, dataAdFormat = 'auto', fullWidthResponsive = 'true' }) => {
    useEffect(() => {
        try {
            // This pushes the ad to the page when the component mounts
            if (window) {
                (window.adsbygoogle = window.adsbygoogle || []).push({});
            }
        } catch (err) {
            console.error('AdSense error', err);
        }
    }, []);

    return (
        <div className="ad-container my-4 text-center w-full overflow-hidden flex justify-center items-center min-h-[90px] bg-slate-800/20 rounded-xl border border-slate-700/50">
            <ins
                className="adsbygoogle"
                style={{ display: 'block', minWidth: '250px', width: '100%' }}
                data-ad-client="ca-pub-9885992062134301"
                data-ad-slot={dataAdSlot}
                data-ad-format={dataAdFormat}
                data-full-width-responsive={fullWidthResponsive}
            />
            {/* Fallback text visible only during dev or before ads load */}
            <span className="text-xs text-slate-500 absolute -z-10">Advertisement</span>
        </div>
    );
};

export default AdBanner;
