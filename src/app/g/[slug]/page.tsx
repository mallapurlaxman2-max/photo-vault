"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import {
  Lock,
  Eye,
  EyeOff,
  Download,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  Camera,
  Share2,
  Check,
  AlertCircle,
  Clock,
  ArrowLeft,
  ArrowRight,
  Key,
} from "lucide-react";

interface Photo {
  id: string;
  filename: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  caption: string | null;
  sortOrder: number;
  isCover: boolean;
  thumbnailUrl: string;
  displayUrl: string;
  downloadUrl: string | null;
}

interface GalleryPublicData {
  id: string;
  slug: string;
  title: string;
  clientName: string;
  eventDate: string | null;
  description: string | null;
  status: string;
  photoCount: number;
  isUnlocked: boolean;
  isDisabled: boolean;
  isExpired: boolean;
  coverThumbnailUrl: string | null;
  allowDownloadOriginal: boolean;
  allowDownloadAll: boolean;
  studio: {
    studioName: string;
    tagline: string;
    name: string;
  };
}

export default function ZeBeyondCustomerGallery({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [loading, setLoading] = useState(true);
  const [gallery, setGallery] = useState<GalleryPublicData | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Password Unlock State
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Lightbox & Slideshow State
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [slideshowActive, setSlideshowActive] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  // Touch Swipe for Mobile Lightbox
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const fetchGalleryInfo = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/gallery/${slug}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gallery not found.");
      }

      setGallery(data.gallery);
      setIsUnlocked(data.gallery.isUnlocked);

      if (data.gallery.isUnlocked) {
        const photoRes = await fetch(`/api/public/gallery/${slug}/photos`);
        const photoData = await photoRes.json();
        if (photoRes.ok) {
          setPhotos(photoData.photos || []);
        }
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchGalleryInfo();
  }, [fetchGalleryInfo]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError(null);
    setUnlocking(true);

    try {
      const res = await fetch(`/api/public/gallery/${slug}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Incorrect passcode.");
      }

      setIsUnlocked(true);
      await fetchGalleryInfo();
    } catch (err: any) {
      setUnlockError(err.message || "Failed to unlock gallery.");
    } finally {
      setUnlocking(false);
    }
  };

  const handlePrev = useCallback(() => {
    if (lightboxIndex === null || photos.length === 0) return;
    setIsZoomed(false);
    setLightboxIndex((prev) => (prev! > 0 ? prev! - 1 : photos.length - 1));
  }, [lightboxIndex, photos.length]);

  const handleNext = useCallback(() => {
    if (lightboxIndex === null || photos.length === 0) return;
    setIsZoomed(false);
    setLightboxIndex((prev) => (prev! < photos.length - 1 ? prev! + 1 : 0));
  }, [lightboxIndex, photos.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxIndex(null);
        setSlideshowActive(false);
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, handlePrev, handleNext]);

  useEffect(() => {
    if (!slideshowActive || lightboxIndex === null) return;
    const interval = setInterval(() => {
      handleNext();
    }, 4000);
    return () => clearInterval(interval);
  }, [slideshowActive, lightboxIndex, handleNext]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (diff > 45) handleNext();
    else if (diff < -45) handlePrev();
    setTouchStart(null);
  };

  const handleLock = async () => {
    await fetch(`/api/public/gallery/${slug}/lock`, { method: "POST" });
    setIsUnlocked(false);
    setPhotos([]);
  };

  const handleDownloadAll = async () => {
    setDownloadingZip(true);
    try {
      window.location.href = `/api/public/gallery/${slug}/download-all`;
      setTimeout(() => setDownloadingZip(false), 5000);
    } catch {
      setDownloadingZip(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060b08] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#00f59b] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!gallery) {
    return (
      <div className="min-h-screen bg-[#060b08] flex flex-col items-center justify-center text-center p-6 text-white max-w-sm mx-auto">
        <Camera className="w-12 h-12 text-[#00f59b] mb-3" />
        <h2 className="text-xl font-bold">Event Not Found</h2>
        <p className="text-xs text-zinc-400 mt-1 mb-6">
          This gallery link may be incorrect or has been archived.
        </p>
        <Link
          href="/"
          className="w-full py-3 rounded-xl emerald-btn text-xs uppercase font-bold text-center"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  if (gallery.isDisabled || gallery.isExpired) {
    return (
      <div className="min-h-screen bg-[#060b08] flex flex-col items-center justify-center text-center p-6 text-white max-w-sm mx-auto space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-[#0b1410] border border-[#00f59b]/30 flex items-center justify-center text-[#00f59b]">
          <Clock className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold">
          {gallery.isExpired ? "Event Gallery Expired" : "Gallery Paused"}
        </h2>
        <p className="text-xs text-zinc-400 leading-relaxed">
          {gallery.isExpired
            ? "The viewing period for this event has ended."
            : "This gallery has been paused by the photographer."}
        </p>
        <Link
          href="/"
          className="mt-4 px-6 py-2.5 rounded-xl bg-zinc-800 text-xs font-semibold text-white"
        >
          Return Home
        </Link>
      </div>
    );
  }

  // -------------------------------------------------------------------
  // PASSWORD GATE VIEW (ZEBEYOND AESTHETIC)
  // -------------------------------------------------------------------
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-[#060b08] text-[#f0fdf4] flex flex-col justify-between p-4 max-w-md mx-auto relative">
        {/* Top Header */}
        <div className="flex items-center justify-between py-2">
          <Link href="/" className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
            <span>Home</span>
          </Link>
          <span className="text-[10px] font-bold text-[#00f59b] uppercase tracking-widest">
            {gallery.studio?.studioName || "ZeBeyond Vault"}
          </span>
        </div>

        {/* Central Card */}
        <div className="my-auto py-6 space-y-6">
          <div className="text-center space-y-3">
            <div className="w-20 h-20 rounded-3xl mx-auto overflow-hidden bg-black/60 border border-[#00f59b]/40 shadow-[0_0_25px_rgba(0,245,155,0.2)] relative flex items-center justify-center">
              {gallery.coverThumbnailUrl ? (
                <img
                  src={gallery.coverThumbnailUrl}
                  alt={gallery.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Camera className="w-8 h-8 text-[#00f59b]" />
              )}
            </div>

            <div>
              <span className="text-[10px] font-bold tracking-widest uppercase text-[#00f59b]">
                Private Photo Gallery
              </span>
              <h1 className="text-2xl font-extrabold text-white mt-0.5">{gallery.title}</h1>
              <p className="text-xs text-zinc-400 mt-1">
                {gallery.clientName} {gallery.eventDate ? `• ${new Date(gallery.eventDate).toLocaleDateString()}` : ""}
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="emerald-card p-6 rounded-3xl space-y-4">
            <div className="text-center">
              <p className="text-xs font-semibold text-zinc-300">Enter Gallery Passcode</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Found on your event QR card</p>
            </div>

            {unlockError && (
              <div className="p-3 rounded-xl bg-red-950/70 border border-red-800/80 text-center text-xs text-red-200">
                {unlockError}
              </div>
            )}

            <form onSubmit={handleUnlock} className="space-y-3">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter passcode"
                  className="w-full px-4 py-3.5 rounded-2xl bg-black/60 border border-[#00f59b]/30 text-center text-base tracking-widest text-white placeholder-zinc-500 focus:outline-none focus:border-[#00f59b] font-mono font-bold"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <button
                type="submit"
                disabled={unlocking}
                className="w-full py-3.5 rounded-2xl emerald-btn text-xs uppercase tracking-wider font-extrabold flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                {unlocking ? "Unlocking..." : "Unlock Photos"}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] text-zinc-600 py-2">
          Protected with cryptographic guest tokens & brute-force shield.
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------
  // UNLOCKED VIEW: HIGH DENSITY PHOTO FEED
  // -------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#060b08] text-[#f0fdf4] flex flex-col justify-between max-w-xl mx-auto border-x border-[#00f59b]/15">
      {/* Sticky Header */}
      <header className="p-3.5 border-b border-[#00f59b]/15 bg-[#060b08]/95 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            className="p-2 rounded-xl bg-[#0b1410] border border-[#00f59b]/20 text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-sm font-bold text-white line-clamp-1">{gallery.title}</h1>
            <p className="text-[10px] text-zinc-400">
              {photos.length} Photos • {gallery.clientName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {gallery.allowDownloadAll && photos.length > 0 && (
            <button
              onClick={handleDownloadAll}
              disabled={downloadingZip}
              className="emerald-btn px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-black" />
              <span>{downloadingZip ? "Zipping..." : "Save All"}</span>
            </button>
          )}

          <button
            onClick={handleLock}
            className="p-2 rounded-xl bg-[#0b1410] text-zinc-400 hover:text-white border border-[#00f59b]/20 cursor-pointer"
            title="Lock Gallery"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Photo Feed */}
      <main className="flex-1 p-3.5 pb-24 space-y-3.5">
        {photos.length === 0 ? (
          <div className="py-20 text-center space-y-2 text-zinc-500">
            <Camera className="w-10 h-10 mx-auto text-[#00f59b]/40" />
            <p className="text-sm font-bold text-white">Photos Being Uploaded</p>
            <p className="text-xs">The photographer has not added photos yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                onClick={() => setLightboxIndex(index)}
                className="group relative aspect-square rounded-2xl overflow-hidden bg-black/60 border border-[#00f59b]/20 shadow-lg cursor-pointer active:scale-97 transition-all"
              >
                <img
                  src={photo.thumbnailUrl}
                  alt={photo.caption || photo.filename}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2.5 flex flex-col justify-end">
                  {photo.caption && (
                    <p className="text-[10px] text-white font-medium truncate mb-1">
                      {photo.caption}
                    </p>
                  )}
                  <span className="text-[9px] text-[#00f59b] font-bold uppercase tracking-wider flex items-center gap-1">
                    <span>Tap to Open</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Bottom Bar */}
      {photos.length > 0 && (
        <div className="fixed bottom-3.5 left-0 right-0 max-w-sm mx-auto px-4 z-20 pointer-events-none">
          <div className="p-2 rounded-2xl shadow-2xl flex items-center justify-between pointer-events-auto bg-[#0b1410]/95 backdrop-blur-md border border-[#00f59b]/30">
            <button
              onClick={() => {
                setLightboxIndex(0);
                setSlideshowActive(true);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-white hover:text-[#00f59b]"
            >
              <Play className="w-3.5 h-3.5 text-[#00f59b]" />
              <span>Slideshow</span>
            </button>

            {gallery.allowDownloadAll && (
              <button
                onClick={handleDownloadAll}
                disabled={downloadingZip}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-[#00f59b]"
              >
                <Download className="w-3.5 h-3.5 text-[#00f59b]" />
                <span>{downloadingZip ? "Zipping..." : "Download ZIP"}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen Lightbox */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 bg-[#060b08]/98 backdrop-blur-md flex flex-col justify-between"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Top Bar */}
          <div className="p-4 flex items-center justify-between text-zinc-300 z-10 bg-gradient-to-b from-black/80 to-transparent">
            <span className="text-xs font-mono font-bold text-[#00f59b]">
              {lightboxIndex + 1} / {photos.length}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSlideshowActive(!slideshowActive)}
                className="p-2 rounded-xl bg-[#0b1410] border border-[#00f59b]/25 text-white"
              >
                {slideshowActive ? <Pause className="w-4 h-4 text-[#00f59b]" /> : <Play className="w-4 h-4" />}
              </button>

              <button
                onClick={() => {
                  setLightboxIndex(null);
                  setSlideshowActive(false);
                }}
                className="p-2 rounded-xl bg-[#0b1410] border border-[#00f59b]/25 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Central Image View */}
          <div className="relative flex-1 flex items-center justify-center p-2 overflow-hidden">
            <img
              src={photos[lightboxIndex].displayUrl}
              alt={photos[lightboxIndex].caption || photos[lightboxIndex].filename}
              className={`max-h-[85vh] max-w-full object-contain transition-transform duration-200 ${
                isZoomed ? "scale-150" : "scale-100"
              }`}
              onClick={() => setIsZoomed(!isZoomed)}
            />

            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white border border-[#00f59b]/30"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white border border-[#00f59b]/30"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Bottom Bar with Direct Download */}
          <div className="p-4 bg-gradient-to-t from-black via-black/80 to-transparent flex items-center justify-between gap-3">
            <div className="text-xs text-zinc-400 truncate flex-1">
              {photos[lightboxIndex].caption || photos[lightboxIndex].filename}
            </div>

            {photos[lightboxIndex].downloadUrl && (
              <a
                href={photos[lightboxIndex].downloadUrl!}
                download={photos[lightboxIndex].filename}
                className="px-5 py-2.5 rounded-xl emerald-btn text-xs font-bold uppercase flex items-center gap-1.5 shadow-lg"
              >
                <Download className="w-4 h-4 text-black" />
                <span>Save to Phone</span>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
