import React, { useState } from 'react';
import { Gift, Flame } from '../../shared/icons';

const PRIZES = [0, 5, 10, 5, 20];
export default function DailyReward({ user, onClaim }) {
  const key = `nearshop_reward_${user?.id || 'guest'}_${new Date().toDateString()}`;
  const [claimed, setClaimed] = useState(() => localStorage.getItem(key) === '1');
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const spin = async () => {
    if (claimed || spinning) return;
    setSpinning(true); await new Promise(r=>setTimeout(r,900));
    const prize = PRIZES[Math.floor(Math.random()*PRIZES.length)];
    setResult(prize); setClaimed(true); localStorage.setItem(key,'1'); setSpinning(false);
    await onClaim(prize);
  };
  return <div className="bg-white rounded-2xl p-4 border border-amber-100"><div className="flex items-center gap-2 font-extrabold text-sm"><Gift size={17} className="text-orange-500"/> Today's Reward <Flame size={15} className="text-orange-500"/></div><div className="text-xs text-gray-400 mt-1">Roz ek free spin. Rewards points/coupons se aa sakte hain.</div><div className="flex items-center gap-3 mt-3"><button disabled={claimed||spinning} onClick={spin} className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 text-white font-extrabold text-sm disabled:opacity-50">{spinning?'...':claimed?'✓ Done':'SPIN'}</button><div className="text-sm">{result!==null?<><b>🎉 {result===0?'Better luck tomorrow!':`+${result} points`}</b><div className="text-xs text-gray-400 mt-1">Kal phir ek chance.</div></>:claimed?<span className="text-gray-500">Aaj ka reward claim ho chuka.</span>:<span className="text-gray-500">Spin karo aur reward lo.</span>}</div></div></div>;
}
