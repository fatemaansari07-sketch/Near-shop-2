import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";

export default function ShopFollowButton({ shopId, userId, compact = false }) {
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    if (!shopId) return () => { live = false; };
    Promise.all([
      userId
        ? supabase.from("feed_follows").select("shop_id").eq("shop_id", shopId).eq("user_id", userId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.rpc("shop_follower_counts"),
    ]).then(([mine, countResult]) => {
      if (!live) return;
      setFollowing(Boolean(mine?.data?.shop_id));
      const found = (countResult?.data || []).find(x => x.shop_id === shopId);
      setFollowers(Number(found?.followers || 0));
    }).catch(() => {
      if (live) setFollowers(0);
    });
    return () => { live = false; };
  }, [shopId, userId]);

  const toggle = async (event) => {
    event?.stopPropagation?.();
    if (!userId) {
      alert("Shop follow karne ke liye pehle login karein.");
      return;
    }
    if (busy) return;
    setBusy(true);
    const wasFollowing = following;
    setFollowing(!wasFollowing);
    setFollowers(n => Math.max(0, Number(n || 0) + (wasFollowing ? -1 : 1)));
    const result = wasFollowing
      ? await supabase.from("feed_follows").delete().eq("user_id", userId).eq("shop_id", shopId)
      : await supabase.from("feed_follows").insert({ user_id: userId, shop_id: shopId });
    setBusy(false);
    if (result.error) {
      setFollowing(wasFollowing);
      setFollowers(n => Math.max(0, Number(n || 0) + (wasFollowing ? 1 : -1)));
      alert("Follow update nahi hua: " + result.error.message);
    }
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={toggle}
      className={`${compact ? "px-3 py-1.5 text-[11px]" : "px-4 py-2 text-xs"} rounded-full font-bold whitespace-nowrap disabled:opacity-60 ${following ? "bg-white/20 text-current border border-current/30" : "bg-emerald-600 text-white"}`}
      aria-label={following ? "Unfollow shop" : "Follow shop"}
    >
      {following ? "Following ✓" : "+ Follow"}
      {followers != null && <span className="ml-1 opacity-80">· {followers}</span>}
    </button>
  );
}
