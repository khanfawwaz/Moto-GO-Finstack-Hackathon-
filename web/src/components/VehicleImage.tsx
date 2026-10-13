import { useEffect, useState } from "react";
import { Bike, CarFront } from "lucide-react";

type VehicleType = "car" | "bike" | "scooter";

const curated: Record<string, string> = {
  // Official MG Comet EV asset; avoid Wikipedia search returning a different MG model.
  "mg-comet-ev": "https://mgmotor.scene7.com/is/image/mgmotor/hd-img-dsc-068?fit=constrain&fmt=webp-alpha&qlt=85&resMode=bisharp&wid=1200",
  "suzuki-access-125": "https://cdn-s3.autocarindia.com/suzuki/Access%20125/_AAB6535.JPG?fm=auto&q=80&w=1600",
  "royal-enfield-hunter-350": "https://images.91wheels.com/assets/b_images/gallery/royalenfield/hunter-350/royalenfield-hunter-350-6-1768629130.png?q=80&w=1600",
  "maruti-suzuki-swift": "https://www.marutisuzuki.com/images/arenabrandimages/color-variant/car-02.webp",
  "tata-punch": "https://imgd.aeplcdn.com/1280x720/n/cw/ec/39015/punch-exterior-right-front-three-quarter-55.jpeg?isig=0&q=80",
};

/** Exact model-page titles make the lightweight Wikimedia lookup dependable. */
const wikipediaTitles: Record<string, string> = {
  "bajaj-platina-110": "Bajaj_Platina", "hero-splendorplus": "Hero_Splendor",
  "yamaha-fascino-125": "Yamaha_Fascino", "tvs-raider-125": "TVS_Raider",
  "honda-sp-160": "Honda_SP_160", "maruti-suzuki-swift": "Suzuki_Swift",
  "vespa-sxl-150": "Vespa", "jawa-42": "Jawa_42", "ktm-390-adventure": "KTM_390_Adventure",
  "hero-xpulse-200-4v": "Hero_Xpulse_200", "triumph-scrambler-400-x": "Triumph_Scrambler_400",
  "triumph-speed-400": "Triumph_Speed_400", "oben-rorr": "Oben_Rorr", "tvs-iqube": "TVS_iQube",
  "ather-450x": "Ather_450", "revolt-rv400": "Revolt_RV400", "ultraviolette-f77": "Ultraviolette_F77",
};

const lookupCache = new Map<string, string | null>();

async function findPhoto(label: string, id?: string | null) {
  const key = id ?? label;
  if (lookupCache.has(key)) return lookupCache.get(key) ?? null;
  const imageSource = async (params: URLSearchParams) => {
    const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`);
    const json = await response.json() as { query?: { pages?: Record<string, { thumbnail?: { source?: string } }> } };
    return Object.values(json.query?.pages ?? {}).find((page) => page.thumbnail?.source)?.thumbnail?.source ?? null;
  };
  const query = new URLSearchParams({
    action: "query", format: "json", origin: "*", prop: "pageimages",
    piprop: "thumbnail", pithumbsize: "1200",
  });
  const exactTitle = id ? wikipediaTitles[id] : null;
  if (exactTitle) query.set("titles", exactTitle);
  else { query.set("generator", "search"); query.set("gsrsearch", label); query.set("gsrnamespace", "0"); query.set("gsrlimit", "1"); }
  try {
    let source = await imageSource(query);
    // Not every current Indian model has its own article. Fall back to a text
    // search instead of leaving the catalogue with a generic icon.
    if (!source && exactTitle) {
      const fallback = new URLSearchParams({ action: "query", format: "json", origin: "*", generator: "search",
        gsrsearch: label, gsrnamespace: "0", gsrlimit: "1", prop: "pageimages", piprop: "thumbnail", pithumbsize: "1200" });
      source = await imageSource(fallback);
    }
    lookupCache.set(key, source);
    return source;
  } catch {
    lookupCache.set(key, null);
    return null;
  }
}

export function VehicleImage({ id, label, type, className = "", priority = false }: {
  id?: string | null; label: string; type: VehicleType; className?: string; priority?: boolean;
}) {
  const [src, setSrc] = useState<string | null>(() => (id ? curated[id] ?? null : null));
  useEffect(() => {
    const fixed = id ? curated[id] : null;
    if (fixed) { setSrc(fixed); return; }
    setSrc(null);
    let active = true;
    findPhoto(label, id).then((photo) => { if (active) setSrc(photo); });
    return () => { active = false; };
  }, [id, label]);

  if (src) return <img src={src} alt={label} className={className} loading={priority ? "eager" : "lazy"} referrerPolicy="no-referrer" onError={() => setSrc(null)} />;
  const Icon = type === "car" ? CarFront : Bike;
  return <span className={`inline-flex items-center justify-center bg-mint text-go-dark ${className}`} aria-label={`${label} photo loading`}><Icon className="h-2/5 w-2/5" aria-hidden /></span>;
}
