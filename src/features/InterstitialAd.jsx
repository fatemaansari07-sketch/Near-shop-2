import React, { useState, useEffect } from "react";
import { X } from "../../shared/icons";

export function InterstitialAd({ onClose }) {
  const [secondsLeft, setSecondsLeft] = useState(3);
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-3xl overflow-hidden bg-white shadow-2xl">
        <div className="relative bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 p-8 text-white text-center">
          <span className="absolute top-3 left-3 text-[10px] bg-white/25 px-2 py-0.5 rounded-full tracking-wide">SPONSORED</span>
          {secondsLeft > 0 ? (
            <span className="absolute top-3 right-3 text-xs bg-black/30 w-6 h-6 rounded-full flex items-center justify-center">{secondsLeft}</span>
          ) : (
            <button onClick={onClose} className="absolute top-3 right-3 bg-black/30 w-6 h-6 rounded-full flex items-center justify-center">
              <X size={14} />
            </button>
          )}
          <div className="text-5xl mb-3">🛍️</div>
          <div className="text-xl font-bold">ShopNear Premium</div>
          <div className="text-sm opacity-90 mt-1">Remove ads &amp; unlock owner reply on reviews — ₹99/month</div>
        </div>
        <div className="p-4">
          <button
            disabled={secondsLeft > 0}
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-gray-100 disabled:opacity-50 font-semibold text-gray-500"
          >
            {secondsLeft > 0 ? `Continue in ${secondsLeft}s` : "Continue to app"}
          </button>
        </div>
      </div>
    </div>
  );
}
