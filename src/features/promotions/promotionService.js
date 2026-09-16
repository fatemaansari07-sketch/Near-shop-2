export const PROMOTION_OPTIONS = [
  { key: 'shop_boost', label: '⭐ Promote Shop', price: 10, scope: 'shop', hours: 24, badge: 'PROMOTED' },
  { key: 'product_boost', label: '🔥 Promote Product', price: 10, scope: 'product', hours: 24, badge: 'FEATURED' },
  { key: 'discount', label: '🏷️ Discount Offer', price: 10, scope: 'product', hours: 24, badge: 'SPECIAL OFFER' },
  { key: 'flash', label: '⚡ Flash Deal', price: 20, scope: 'product', hours: 24, badge: 'FLASH DEAL' },
  { key: 'nearby_first', label: '📍 Nearby Me First', price: 20, scope: 'shop', hours: 24, badge: 'NEARBY FIRST' },
  { key: 'top_shop', label: '🏆 Top Shop', price: 30, scope: 'shop', hours: 24, badge: 'TOP SHOP' },
  { key: 'announcement', label: '📢 Announcement', price: 10, scope: 'shop', hours: 24, badge: 'ANNOUNCEMENT' },
  { key: 'new_stock', label: '🆕 New Stock', price: 10, scope: 'shop', hours: 24, badge: 'NEW STOCK' },
  { key: 'coupon', label: '🏷️ Coupon', price: 10, scope: 'shop', hours: 24, badge: 'COUPON' },
];
export const isPromotionActive = p => Boolean(p?.expiresAt && new Date(p.expiresAt).getTime() > Date.now());
export const promotionRank = p => { if (!isPromotionActive(p)) return 0; return ({top_shop:100,nearby_first:90,shop_boost:80,announcement:60,new_stock:55,coupon:50}[p.type]||0); };
export const productPromotionRank = p => { if (!isPromotionActive(p)) return 0; return ({flash:100,discount:90,product_boost:80}[p.type]||0); };
export const makePromotion = ({type,amount,hours,...payload}) => ({type,amount:Number(amount)||0,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+Number(hours||24)*3600000).toISOString(),...payload});
