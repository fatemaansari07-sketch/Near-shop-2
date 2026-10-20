export const PROMOTION_OPTIONS = [
  { key: 'shop_boost', label: '⭐ Promote Shop', price: 10, scope: 'shop', hours: 24, badge: 'PROMOTED' },
  { key: 'product_boost', label: '🔥 Promote Product', price: 10, scope: 'product', hours: 24, badge: 'FEATURED' },
  { key: 'discount', label: '🏷️ Discount Deal — 24h', price: 10, scope: 'product', hours: 24, badge: 'SPECIAL DEAL' },
  { key: 'flash', label: '⚡ Flash Deal', price: 20, scope: 'product', hours: 24, badge: 'FLASH DEAL' },
  { key: 'nearby_first', label: '📍 Nearby Me First', price: 20, scope: 'shop', hours: 24, badge: 'NEARBY FIRST' },
  { key: 'top_shop', label: '🏆 Top Shop', price: 30, scope: 'shop', hours: 24, badge: 'TOP SHOP' },
  { key: 'announcement', label: '📢 Announcement', price: 10, scope: 'shop', hours: 24, badge: 'ANNOUNCEMENT' },
  { key: 'new_stock', label: '🆕 New Stock', price: 10, scope: 'shop', hours: 24, badge: 'NEW STOCK' },
  { key: 'coupon', label: '🏷️ Coupon', price: 10, scope: 'shop', hours: 24, badge: 'COUPON' },
  { key: 'reward_wheel', label: '🎡 Spin & Win Campaign', price: 20, scope: 'shop', hours: 24, badge: 'SPIN & WIN' },
  { key: 'demand_alert', label: '🎯 Demand Alert Unlock', price: 10, scope: 'shop', hours: 24, badge: 'DEMAND ALERT' },
];
export const isPromotionActive = p => Boolean(p?.expiresAt && new Date(p.expiresAt).getTime() > Date.now());
export const promotionRank = (p, distanceKm) => { if (!isPromotionActive(p)) return 0; if (p.type === 'nearby_first' && p.radiusKm != null && distanceKm != null && Number(distanceKm) > Number(p.radiusKm)) return 0; return ({top_shop:100,nearby_first:90,shop_boost:80,announcement:60,new_stock:55,coupon:50,reward_wheel:45}[p.type]||0); };
export const productPromotionRank = p => { if (!isPromotionActive(p)) return 0; return ({flash:100,discount:90,product_boost:80}[p.type]||0); };
export const makePromotion = ({type,amount,hours,...payload}) => ({type,amount:Number(amount)||0,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+Number(hours||24)*3600000).toISOString(),...payload});

// Shopkeeper ko samjhane ke liye: har option kya karta hai, customer ko kahan dikhta hai, fayda kya.
export const PROMOTION_INFO = {
  shop_boost: { short: 'Aapki dukaan list me upar', what: 'Discover/search list me aapki dukaan dusri dukaano se pehle dikhti hai, "PROMOTED" label ke saath.', where: 'Discover tab ki shop list me upar.', benefit: 'Zyada customers pehle aapki dukaan kholte hain.', how: 'Bas shop select karo, kuch aur likhna nahi.' },
  product_boost: { short: 'Ek product ko featured karo', what: 'Aapka ek chuna hua product "FEATURED" ban kar Deals me dikhta hai.', where: 'Deals tab me, aur dukaan ke page par.', benefit: 'Jis product ki bikri badhani hai, uspe customer ka dhyan jata hai.', how: 'Product chuno.' },
  discount: { short: 'Product pe % discount (24h)', what: 'Ek product pe discount lagta hai. Purana price kata hua, naya price aur "% OFF" dikhta hai.', where: 'Deals tab me — customer tap kare to seedha us product ka page khulta hai.', benefit: 'Discount dekh kar customer jaldi kharidta hai.', how: 'Product chuno aur discount % daalo (5–30% quick buttons hain).' },
  flash: { short: 'Limited time bada discount', what: 'Discount Deal jaisa hi, par "FLASH DEAL" ke naam se sabse upar dikhta hai.', where: 'Deals tab ke sabse upar.', benefit: 'Jaldi bikri; kam time ka offer hone se customer turant aata hai.', how: 'Product chuno aur discount % daalo.' },
  nearby_first: { short: 'Paas ke customers ko pehle dikho', what: 'Jo customer aapke chune hue radius (1–10 km) me hai, usko aapki dukaan pehle dikhti hai.', where: 'Discover list me, sirf radius ke andar wale customers ko.', benefit: 'Aas-paas ke asli grahak, jo aasani se dukaan tak aa sakte hain.', how: 'Radius chuno.' },
  top_shop: { short: 'Sabse upar TOP SHOP', what: 'Aapki dukaan sabse upar "TOP SHOP" badge ke saath dikhti hai (sabse zyada priority).', where: 'Discover list ke sabse upar.', benefit: 'Sabse zyada nazar aati hai, bharosa bhi badhta hai.', how: 'Bas shop select karo.' },
  announcement: { short: 'Customers ko message', what: 'Ek chhota message likho, jaise "Aaj sab pe 10% off" ya "Dukaan kal band rahegi".', where: 'Deals tab ke "Shop Offers" me, aur dukaan ke page par.', benefit: 'Free me bol sakte ho kya chal raha hai; customer ko seedha pata chalta hai.', how: 'Message likho.' },
  new_stock: { short: 'Naya maal aaya', what: 'Naya stock aane ka message "NEW STOCK" badge ke saath dikhta hai.', where: 'Deals tab ke "Shop Offers" me, aur dukaan ke page par.', benefit: 'Jo customer us cheez ka intezar kar rahe the, wo turant aate hain.', how: 'Likho kya naya aaya (jaise "Baby diapers aa gaye").' },
  coupon: { short: 'Coupon / discount offer', what: 'Ek coupon offer likho, jaise "₹100 OFF ₹1000 se upar". Customer dukaan pe aakar ye dikhata hai.', where: 'Deals tab me, sabse upar "Coupons" me. Tap karte hi dukaan ka page khulta hai jahan coupon likha dikhta hai.', benefit: 'Customer ko dukaan tak aane ki wajah milti hai aur bill bada hota hai.', how: 'Coupon ka offer text likho.' },
  reward_wheel: { short: 'Spin & Win campaign', what: 'Customer spin karke prize jeet sakta hai (jaise 10% OFF ya ₹50 coupon).', where: 'Deals tab me "Spin & Win" ke naam se.', benefit: 'Khel ke bahane customer aata hai aur yaad rakhta hai.', how: 'Prize/offer likho.' },
  demand_alert: { short: 'Dekho log kya dhundh rahe hain', what: 'Aapke area ke customers ne haal me kya search kiya, uski list unlock hoti hai.', where: 'Sirf aapko, is Promote panel me "Demand Alert" box me.', benefit: 'Pata chalta hai kaunsa maal rakhna chahiye, taaki customer khali haath na lautein.', how: 'Bas unlock karo — customer ko kuch nahi dikhta.' },
};
export const SHOP_LEVEL_NOTE = 'Dhyan: ek dukaan par ek waqt me ek hi shop-level offer chalta hai. Naya lagaoge to pehla replace ho jayega.';
