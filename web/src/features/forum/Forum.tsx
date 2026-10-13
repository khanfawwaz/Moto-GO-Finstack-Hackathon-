import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, BookOpen, MessagesSquare, Play, Search, Users } from "lucide-react";
import { cx, PageHeader } from "@/components/ui";
import { COMMUNITY, REVIEWS, thumbnailUrl, videoUrl, type VehicleKind } from "./content";

const TYPES = [["", "All vehicles"], ["car", "Cars"], ["bike", "Bikes"], ["scooter", "Scooters"]] as const;
const KINDS = [["", "All posts"], ["community", "Community"], ["review", "Reviews"], ["video", "Videos"]] as const;
type Kind = typeof KINDS[number][0];
type Review = typeof REVIEWS[number];
type Community = typeof COMMUNITY[number];
type Post = { id: string; kind: Exclude<Kind, "">; vehicle: Review; member?: Community; timestamp: string };

// Illustrative feed dates, not publication dates or real member activity.
const POSTS: Post[] = REVIEWS.flatMap((vehicle, i) => {
  const member = COMMUNITY.find(a => a.reviewId === vehicle.id);
  return [
    ...(member ? [{ id: `community-${vehicle.id}`, kind: "community" as const, vehicle, member, timestamp: `2026-10-13T${i ? "10:15" : "10:30"}:00+05:30` }] : []),
    { id: `review-${vehicle.id}`, kind: "review" as const, vehicle, timestamp: `2026-10-13T09:${String(50 - i * 10)}:00+05:30` },
    { id: `video-${vehicle.id}`, kind: "video" as const, vehicle, timestamp: `2026-10-12T18:${String(50 - i * 10)}:00+05:30` },
  ];
}).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
const feedDate = (date: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(date));

export default function Forum() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<VehicleKind | "">("");
  const [kind, setKind] = useState<Kind>("");
  const posts = POSTS.filter(p => (!type || p.vehicle.type === type) && (!kind || p.kind === kind)
    && `${p.vehicle.vehicle} ${p.vehicle.creator} ${p.vehicle.publisher} ${p.member?.name ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <>
    <PageHeader title="Forum" sub="New keys, first drives and perspectives worth sharing."
      action={<Link to="/explore" className="btn-ghost">Explore vehicles <ArrowUpRight className="h-4 w-4" aria-hidden /></Link>} />
    <div className="w-full">
      <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden /><input className="input pl-10" aria-label="Search Forum" placeholder="Search a vehicle, creator or member" value={query} onChange={e => setQuery(e.target.value)} /></div>
        <select className="input" aria-label="Forum vehicle type" value={type} onChange={e => setType(e.target.value as VehicleKind | "")}>{TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
      </div>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Feed content type">{KINDS.map(([id, label]) => <button key={id} className={cx("!min-h-[38px] !px-3 text-sm", kind === id ? "btn-go" : "btn-ghost")} aria-pressed={kind === id} onClick={() => setKind(id)}>{label}</button>)}</div>
      <div className="mb-5 flex items-start gap-2 rounded-xl border border-sun/25 bg-sun-light p-3"><Users className="mt-0.5 h-4 w-4 shrink-0 text-sun-dark" aria-hidden /><p className="text-xs leading-relaxed text-ink-soft"><strong className="text-sun-dark">Demo community feed</strong> · Member updates and feed dates are illustrative, not live activity. Curated posts link to original reviews and creator videos; their publication editions are shown separately. All times IST.</p></div>

      <div role="feed" aria-label="Automotive community feed" className="space-y-4">{posts.map(post => {
        const r = post.vehicle;
        const member = post.member;
        const Icon = post.kind === "community" ? Users : post.kind === "review" ? BookOpen : Play;
        return <article key={post.id} aria-label={`${post.kind === "community" ? member!.name : post.kind === "review" ? r.publisher : r.creator} · ${r.vehicle}`} className="card !p-0">
          <header className="flex items-start gap-3 border-b border-ink/10 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-go-light font-black text-go-dark" aria-hidden>{member ? member.initials : <Icon className="h-4 w-4" />}</span>
            <div className="min-w-0 flex-1"><p className="font-bold text-ink">{member?.name ?? (post.kind === "review" ? r.publisher : r.creator)}</p><p className="text-xs text-ink-mute">{post.kind === "community" ? `Sample update · ${member!.badge}` : post.kind === "review" ? "Curated review" : "Creator video · YouTube"}</p></div>
            <time dateTime={post.timestamp} title="Illustrative demo feed timestamp" className="max-w-[135px] text-right font-mono text-[10px] leading-relaxed text-ink-mute">{feedDate(post.timestamp)} IST</time>
          </header>
          {post.kind === "community" ? <div className="p-4">
            <p className="mb-3 text-base leading-relaxed"><strong>{member!.name}</strong> {member!.action} <strong>{r.vehicle}</strong></p>
            <a href={r.review} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-ink/15 p-2"><ReviewImage videoId={r.videoId} vehicle={r.vehicle} className="h-20 w-28 shrink-0 rounded-lg object-cover" /><span className="text-sm font-bold text-sky-dark">Get to know the vehicle <ArrowUpRight className="inline h-4 w-4" aria-hidden /></span></a>
          </div> : post.kind === "review" ? <div className="p-4">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-go-dark">{r.topic}</p><h3 className="mb-2 text-2xl">{r.vehicle}</h3><p className="mb-3 text-sm text-ink-soft">{r.description}</p>
            <a href={r.review} target="_blank" rel="noopener noreferrer" aria-label={`Read ${r.vehicle} review on ${r.publisher}`}><ReviewImage videoId={r.videoId} vehicle={r.vehicle} className="max-h-64 w-full rounded-xl object-cover" /></a>
            <p className="mt-3 text-xs text-ink-mute">{r.publisher} · {r.edition}</p><div className="mt-3 flex flex-wrap gap-2"><a href={r.review} target="_blank" rel="noopener noreferrer" className="btn-ghost !min-h-[40px] text-sm">Read review <ArrowUpRight className="h-4 w-4" aria-hidden /></a>{r.modelId && <Link to={`/explore?model=${r.modelId}`} className="btn-quiet text-sm">Explore this vehicle →</Link>}</div>
          </div> : <div className="p-4">
            <h3 className="mb-3 text-xl">{r.videoTitle}</h3><a href={videoUrl(r.videoId)} target="_blank" rel="noopener noreferrer" className="group relative block overflow-hidden rounded-xl" aria-label={`Watch ${r.vehicle} review by ${r.creator} on YouTube`}><ReviewImage videoId={r.videoId} vehicle={r.vehicle} className="aspect-video w-full object-cover" /><span className="absolute inset-0 flex items-center justify-center bg-black/15"><span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/40 bg-black/70 text-white transition-transform group-hover:scale-110"><Play className="h-6 w-6" aria-hidden /></span></span></a><p className="mt-3 text-xs font-bold text-coral-dark">{r.creator} · {r.videoEdition}</p><a href={videoUrl(r.videoId)} target="_blank" rel="noopener noreferrer" className="btn-quiet mt-2 text-sm">Watch on YouTube <ArrowUpRight className="h-4 w-4" aria-hidden /></a>
          </div>}
        </article>;
      })}</div>
      {!posts.length && <p role="status" className="card text-sm">No reviews or videos match. Try another vehicle, creator or type.</p>}
      <p className="mt-6 text-xs leading-relaxed text-ink-mute">External content is curated, not sponsored. Opinions belong to the original publishers and creators. Thumbnails come from the linked YouTube reviews. Posting is not enabled yet.</p>
    </div>
  </>;
}

function ReviewImage({ videoId, vehicle, className }: { videoId: string; vehicle: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={cx("inline-flex items-center justify-center bg-go-light p-2 text-center text-xs text-go-dark", className)}><MessagesSquare className="mr-1 h-5 w-5 shrink-0" aria-hidden />{vehicle}</span>;
  return <img src={thumbnailUrl(videoId)} alt={`${vehicle} review thumbnail`} loading="lazy" referrerPolicy="no-referrer" className={className} onError={() => setFailed(true)} />;
}
