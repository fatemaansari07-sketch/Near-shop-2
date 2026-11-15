// Shared product-unit catalogue used by Quick Add, Full Add, Edit and Billing.
// "pack" is the legacy medical strip unit; "weight"/"volume"/"length" keep
// their existing base-unit conversion behaviour. Other units are counted directly.
export const PRODUCT_UNIT_OPTIONS = [
  ["piece", "Piece / Pcs"],
  ["pair", "Pair"],
  ["box", "Box"],
  ["bucket", "Bucket"],
  ["tin", "Tin"],
  ["bottle", "Bottle"],
  ["dozen", "Dozen"],
  ["set", "Set"],
  ["pack_unit", "Pack"],
  ["carton", "Carton"],
  ["sack", "Sack / Bag"],
  ["roll", "Roll"],
  ["bundle", "Bundle"],
  ["pack", "Strip / Patta"],
  ["weight", "Kg / Gram"],
  ["volume", "Litre / ML"],
  ["length", "Meter / CM"],
];

export const UNIT_LABELS = Object.fromEntries(PRODUCT_UNIT_OPTIONS);
export const UNIT_SHORT_LABELS = {
  piece: "pcs", pair: "pair", box: "box", bucket: "bucket", tin: "tin",
  bottle: "bottle", dozen: "dozen", set: "set", pack_unit: "pack",
  carton: "carton", sack: "bag", roll: "roll", bundle: "bundle",
  strip: "strip", tablet: "goli", kg: "kg", g: "g", l: "L", ml: "ml",
  m: "m", cm: "cm",
};

export const UNIT_VOICE_PATTERNS = [
  ["strip", "patta|patte|pattey|strip|strips"],
  ["tablet", "goli|goliyan|goliya|tablet|tablets|tab|taibalet|taiblet|capsule|capsules"],
  ["kg", "kg|kgs|kilo|kilos|kilogram|kilograms"],
  ["g", "gram|grams|gm|gms|graam"],
  ["ml", "ml|millilitre|milliliter|mililitar"],
  ["l", "litre|litres|liter|liters|ltr|litar"],
  ["cm", "cm|centimeter|centimetre|santimitar"],
  ["m", "meter|metre|meters|metres|mitar"],
  ["piece", "piece|pieces|pcs|pc|nag|nags"],
  ["pair", "pair|pairs|jodi|jode"],
  ["box", "box|boxes|dabba|dabbe"],
  ["bucket", "bucket|buckets|balti|baltian"],
  ["tin", "tin|tins|can|cans"],
  ["bottle", "bottle|bottles|botal|botale"],
  ["dozen", "dozen|dozens"],
  ["set", "set|sets"],
  ["pack_unit", "pack|packs|packet|packets|paket|pouch|pouches"],
  ["carton", "carton|cartons"],
  ["sack", "sack|sacks|bag|bags|bori|bore"],
  ["roll", "roll|rolls"],
  ["bundle", "bundle|bundles|gaddi"],
];

export const UNIT_STOCK_LABELS = {
  piece: "pcs", pair: "pair", box: "box", bucket: "bucket", tin: "tin",
  bottle: "bottle", dozen: "dozen", set: "set", pack_unit: "pack",
  carton: "carton", sack: "bag", roll: "roll", bundle: "bundle",
  pack: "tablets", weight: "kg", volume: "L", length: "m",
};

export const UNIT_INPUT_LABELS = {
  piece: "Pcs", pair: "Pair", box: "Box", bucket: "Bucket", tin: "Tin",
  bottle: "Bottle", dozen: "Dozen", set: "Set", pack_unit: "Pack",
  carton: "Carton", sack: "Bag", roll: "Roll", bundle: "Bundle",
  pack: "Strip", weight: "Kg", volume: "Litre", length: "Meter",
};
