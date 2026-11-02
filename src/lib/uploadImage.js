import { supabase } from "../supabaseClient";
import { genId } from "../data/mockData";

// Phone photos 4-8 MB hoti hain; upload se pehle chhota kar do.
export async function compressImage(file, max = 1280, q = 0.82) {
  try {
    const bmp = await createImageBitmap(file);
    const r = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", q));
    return blob ? new File([blob], (file.name.replace(/\.[^.]+$/, "") || "photo").replace(/[^\w-]/g, "_") + ".jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}

export async function uploadProductImage(shopId, file) {
  if (!file) return null;
  const f = await compressImage(file);
  const path = `${shopId}/${genId("img")}-${f.name}`;
  const { error } = await supabase.storage.from("product-images").upload(path, f);
  if (error) return null;
  return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}
