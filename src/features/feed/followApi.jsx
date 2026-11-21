import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";

// Follow state for the logged-in user. Same tables the Feed uses (feed_follows + shop_follower_counts).
export function useFollow(userId) {
  const [follows, setFollows] = useState(() => new Set());
  const [counts, setCounts] = useState({});
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [f, c] = await Promise.all([
          userId ? supabase.from("feed_follows").select("shop_id").eq("user_id", userId) : { data: [] },
          supabase.rpc("shop_follower_counts"),
        ]);
        if (!live) return;
        setFollows(new Set((f.data || []).map((x) => x.shop_id)));
        setCounts(Object.fromEntries((c.data || []).map((x) => [x.shop_id, Number(x.followers)])));
      } catch {}
    })();
    return () => { live = false; };
  }, [userId]);
  const toggle = useCallback(async (shopId) => {
    if (!userId) return;
    const was = follows.has(shopId);
    setFollows((s) => { const n = new Set(s); was ? n.delete(shopId) : n.add(shopId); return n; });
    setCounts((c) => ({ ...c, [shopId]: Math.max(0, (c[shopId] || 0) + (was ? -1 : 1)) }));
    const { error } = was
      ? await supabase.from("feed_follows").delete().eq("user_id", userId).eq("shop_id", shopId)
      : await supabase.from("feed_follows").insert({ user_id: userId, shop_id: shopId });
    if (error) { // roll back
      setFollows((s) => { const n = new Set(s); was ? n.add(shopId) : n.delete(shopId); return n; });
      setCounts((c) => ({ ...c, [shopId]: Math.max(0, (c[shopId] || 0) + (was ? 1 : -1)) }));
    }
  }, [userId, follows]);
  return { isFollowing: (id) => follows.has(id), count: (id) => counts[id] || 0, toggle, enabled: !!userId };
}

export const FollowButton = ({ shop, follow, userId, className = "" }) => {
  if (!follow?.enabled || !shop || shop.owner_id === userId) return null;
  const on = follow.isFollowing(shop.id);
  return <button type="button" onClick={(e) => { e.stopPropagation(); follow.toggle(shop.id); }}
    className={`text-xs font-bold px-3 py-1.5 rounded-full ${on ? "bg-gray-100 text-gray-600" : "bg-emerald-600 text-white"} ${className}`}>{on ? "Following ✓" : "+ Follow"}</button>;
};
