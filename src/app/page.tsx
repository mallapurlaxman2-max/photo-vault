"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  QrCode,
  Lock,
  ArrowRight,
  Camera,
  Sparkles,
  ShieldCheck,
  Download,
  Plus,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Layers,
  Image as ImageIcon,
  Key,
  X,
  LogOut,
  Upload,
  Search,
  Filter,
  ChevronDown,
} from "lucide-react";

interface GalleryItem {
  id: string;
  slug: string;
  title: string;
  clientName: string;
  photoCount: number;
  status: string;
  publicUrl: string;
  coverPhotoId: string | null;
  eventDate?: string | null;
}

export default function BAPhotoVaultApp() {
  const router = useRouter();

  // Mode: "guest" (default) or "admin" (photographer)
  const [activeTab, setActiveTab] = useState<"guest" | "admin">("guest");
  const [accessCode, setAccessCode] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Admin state
  const [isOwnerLoggedIn, setIsOwnerLoggedIn] = useState(false);
  const [ownerData, setOwnerData] = useState<any>(null);
  const [galleries, setGalleries] = useState<GalleryItem[]>([]);
  const [loginEmail, setLoginEmail] = useState("mallapurlaxman2@gmail.com");
  const [loginPassword, setLoginPassword] = useState("LaxmanPhotographer2026!");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Quick Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createClient, setCreateClient] = useState("");
  const [createPassword, setCreatePassword] = useState("1234");
  const [creating, setCreating] = useState(false);

  // QR Modal
  const [qrModalItem, setQrModalItem] = useState<GalleryItem | null>(null);
  const [qrPng, setQrPng] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // PWA Install Prompt for Android
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setCanInstall(false);
      setDeferredPrompt(null);
    } else {
      alert("To install on your Android phone:\n1. Tap the 3 dots (⋮) in your Chrome browser\n2. Tap 'Install app' or 'Add to Home screen'\n\nIt installs directly onto your phone as a native app!");
    }
  };

  // Check auth & fetch galleries
  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.authenticated) {
        setIsOwnerLoggedIn(true);
        setOwnerData(data.owner);
        fetchGalleries();
      } else {
        setIsOwnerLoggedIn(false);
      }
    } catch {
      setIsOwnerLoggedIn(false);
    }
  };

  const fetchGalleries = async () => {
    try {
      const res = await fetch("/api/galleries");
      const data = await res.json();
      if (res.ok) {
        setGalleries(data.galleries || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    checkAuth();
    fetchGalleries();
  }, []);

  const handleGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim()) return;

    let target = accessCode.trim();
    if (target.includes("/g/")) {
      target = target.split("/g/")[1];
    }
    target = target.split("?")[0].replace(/^\/+|\/+$/g, "");

    const matched = galleries.find(
      (g) =>
        g.slug.toLowerCase().includes(target.toLowerCase()) ||
        g.title.toLowerCase().includes(target.toLowerCase()) ||
        g.clientName.toLowerCase().includes(target.toLowerCase())
    );

    if (matched) {
      router.push(`/g/${matched.slug}`);
    } else {
      router.push(`/g/${target}`);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed.");
      }

      setIsOwnerLoggedIn(true);
      setOwnerData(data.owner);
      fetchGalleries();
    } catch (err: any) {
      setLoginError(err.message || "Failed to log in.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setIsOwnerLoggedIn(false);
    setOwnerData(null);
  };

  const handleCreateGallery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) return;
    setCreating(true);

    try {
      const res = await fetch("/api/galleries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createTitle.trim(),
          clientName: createClient.trim() || createTitle.trim(),
          password: createPassword.trim() || "1234",
          allowDownloadOriginal: true,
          allowDownloadAll: true,
        }),
      });

      const data = await res.json();
      if (res.ok && data.gallery) {
        setCreateModalOpen(false);
        setCreateTitle("");
        setCreateClient("");
        setCreatePassword("1234");
        await fetchGalleries();
        handleShowQR(data.gallery);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleShowQR = async (gallery: GalleryItem) => {
    setQrModalItem(gallery);
    try {
      const res = await fetch(`/api/galleries/${gallery.id}/qr?format=json`);
      const data = await res.json();
      setQrPng(data.pngDataUrl);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopy = (url: string, slug: string) => {
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  const handleWhatsAppShare = (title: string, url: string) => {
    const text = encodeURIComponent(`📸 View our event photo gallery for "${title}": ${url}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  const filteredGalleries = galleries.filter((g) => {
    const matchesSearch =
      g.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      g.clientName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      g.slug.toLowerCase().includes(searchFilter.toLowerCase());

    if (selectedCategory === "All") return matchesSearch;
    if (selectedCategory === "Weddings") return matchesSearch && g.title.toLowerCase().includes("wedding");
    if (selectedCategory === "Galas") return matchesSearch && (g.title.toLowerCase().includes("gala") || g.title.toLowerCase().includes("farewell"));
    if (selectedCategory === "Birthdays") return matchesSearch && g.title.toLowerCase().includes("birthday");
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#060b08] text-[#f0fdf4] selection:bg-[#00f59b] selection:text-black relative">
      {/* Background Emerald Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-[#00f59b]/8 blur-[140px] pointer-events-none rounded-full" />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#060b08]/90 backdrop-blur-md border-b border-[#00f59b]/15 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#00f59b] flex items-center justify-center text-black font-black text-sm tracking-tight shadow-[0_0_15px_rgba(0,245,155,0.4)]">
            BA
          </div>
          <Link href="/" className="font-extrabold text-lg sm:text-xl tracking-tight text-white flex items-center gap-1.5">
            <span>BA Photo Vault</span>
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#00f59b]/15 text-[#00f59b] border border-[#00f59b]/30">
              LAXMAN M
            </span>
          </Link>
        </div>

        {/* Right Action Switcher */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleInstallClick}
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#00f59b]/10 text-[#00f59b] border border-[#00f59b]/30 hover:bg-[#00f59b]/20 flex items-center gap-1.5 cursor-pointer transition-all"
            title="Install Android App"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden xs:inline sm:inline">Install App</span>
          </button>

          <button
            onClick={() => setActiveTab(activeTab === "guest" ? "admin" : "guest")}
            className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "admin"
                ? "bg-zinc-800 text-zinc-300 border border-zinc-700"
                : "emerald-btn"
            }`}
          >
            {activeTab === "guest" ? (
              <>
                <Camera className="w-3.5 h-3.5 text-black" />
                <span>Photographer Mode</span>
              </>
            ) : (
              <>
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Back to Guest View</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-10 relative z-10">
        {/* ============================================================== */}
        {/* GUEST MODE: MATCHING THE ZEBEYOND DESIGN SCREENSHOT            */}
        {/* ============================================================== */}
        {activeTab === "guest" && (
          <div className="space-y-10 animate-in fade-in duration-300">
            {/* Hero Section */}
            <div className="space-y-4 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00f59b]/10 border border-[#00f59b]/30 text-[#00f59b] text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Instant QR Photo Delivery Platform</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
                Access and download <br />
                <span className="text-[#00f59b]">event photos fast</span>
              </h1>

              <p className="text-sm sm:text-base text-zinc-400 font-normal leading-relaxed">
                Scan your event QR code or enter your passcode to view high-resolution photographs with unprecedented speed and fidelity.
              </p>

              {/* Quick Code Resolver Form */}
              <form onSubmit={handleGuestSubmit} className="pt-2 flex flex-col sm:flex-row gap-3 max-w-md">
                <div className="relative flex-1">
                  <Key className="w-4 h-4 text-[#00f59b] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder="Enter gallery code (e.g. rahul-priya)"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#0b1410] border border-[#00f59b]/25 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#00f59b] focus:ring-1 focus:ring-[#00f59b]"
                  />
                </div>
                <button
                  type="submit"
                  className="emerald-btn px-6 py-3 rounded-xl text-xs uppercase tracking-wider font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                >
                  <span>Unlock</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Event Case Studies / Galleries Section (Direct match to screenshot) */}
            <div className="space-y-6 pt-4 border-t border-[#00f59b]/15">
              {/* Header with Title and Search/Filters */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    Event Galleries
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                    Discover and download curated client celebrations.
                  </p>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {["All", "Weddings", "Galas", "Birthdays"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        selectedCategory === cat
                          ? "bg-[#00f59b] text-black shadow-[0_0_15px_rgba(0,245,155,0.3)]"
                          : "bg-[#0b1410] text-zinc-400 border border-[#00f59b]/20 hover:text-white"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gallery Cards Grid (Styled exactly like ZeBeyond Card in image) */}
              {filteredGalleries.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-[#0b1410] border border-[#00f59b]/20 space-y-2">
                  <Camera className="w-8 h-8 text-[#00f59b] mx-auto opacity-60" />
                  <p className="text-sm font-bold text-white">No Event Galleries Found</p>
                  <p className="text-xs text-zinc-400">Try clearing your search or switch to Photographer mode to create one.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredGalleries.map((gallery) => (
                    <Link
                      key={gallery.id}
                      href={`/g/${gallery.slug}`}
                      className="emerald-card group p-4 sm:p-5 rounded-2xl flex flex-col justify-between space-y-4 cursor-pointer"
                    >
                      {/* Image Preview Container */}
                      <div className="aspect-[16/10] rounded-xl overflow-hidden bg-black/60 relative border border-[#00f59b]/15 flex items-center justify-center">
                        {gallery.coverPhotoId ? (
                          <img
                            src={`/api/public/gallery/${gallery.slug}/photo/${gallery.coverPhotoId}?type=thumbnail&publicCover=true`}
                            alt={gallery.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-zinc-600 gap-1.5">
                            <ImageIcon className="w-8 h-8 text-[#00f59b]/40" />
                            <span className="text-[10px] text-zinc-500">Event Ready</span>
                          </div>
                        )}

                        {/* Top Badges (like in screenshot) */}
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                          <span className="text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-black/70 text-[#00f59b] border border-[#00f59b]/30 backdrop-blur-md">
                            4K HD
                          </span>
                          <span className="text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#00f59b] text-black">
                            {gallery.status}
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="space-y-1.5">
                        <h3 className="font-bold text-base sm:text-lg text-white group-hover:text-[#00f59b] transition-colors line-clamp-1">
                          {gallery.title}
                        </h3>
                        <p className="text-xs text-zinc-400 line-clamp-1">
                          {gallery.clientName} • {gallery.photoCount} photographs
                        </p>
                      </div>

                      {/* Action Link with Green Arrow (direct match to screenshot) */}
                      <div className="pt-2 border-t border-[#00f59b]/10 flex items-center justify-between text-xs font-semibold text-[#00f59b]">
                        <span>Enter Passcode & View</span>
                        <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PHOTOGRAPHER MODE: DASHBOARD & FAST EVENT CREATION             */}
        {/* ============================================================== */}
        {activeTab === "admin" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {!isOwnerLoggedIn ? (
              /* Quick Sign In Card */
              <div className="max-w-md mx-auto p-6 sm:p-8 rounded-3xl bg-[#0b1410] border border-[#00f59b]/30 shadow-2xl space-y-5">
                <div className="text-center space-y-1.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#00f59b]/10 border border-[#00f59b]/40 flex items-center justify-center mx-auto text-[#00f59b]">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Photographer Studio Login</h3>
                  <p className="text-xs text-zinc-400">
                    Sign in to manage event galleries, upload photos, and generate QR codes.
                  </p>
                </div>

                {loginError && (
                  <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs">
                    {loginError}
                  </div>
                )}

                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-black/60 border border-[#00f59b]/30 text-sm text-white focus:outline-none focus:border-[#00f59b]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-black/60 border border-[#00f59b]/30 text-sm text-white focus:outline-none focus:border-[#00f59b]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full py-3.5 rounded-xl emerald-btn text-xs tracking-wider uppercase font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                  >
                    {loginLoading ? "Authenticating..." : "Open Photographer Dashboard"}
                  </button>
                </form>

                <p className="text-center text-[11px] text-zinc-500">
                  Pre-filled with master photographer test credentials for 1-tap sign-in.
                </p>
              </div>
            ) : (
              /* Photographer Studio Controls */
              <div className="space-y-6">
                {/* Header with Logout & Quick Stats */}
                <div className="p-5 rounded-2xl bg-[#0b1410] border border-[#00f59b]/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#00f59b] font-bold">
                      Authenticated Master Studio
                    </span>
                    <h3 className="text-lg font-bold text-white">{ownerData?.name} • {ownerData?.studioName}</h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setCreateModalOpen(true)}
                      className="emerald-btn px-4 py-2 rounded-xl text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Plus className="w-4 h-4 text-black" />
                      <span>Create New Event</span>
                    </button>

                    <button
                      onClick={handleAdminLogout}
                      className="px-3 py-2 rounded-xl bg-red-950/40 text-red-400 border border-red-900/60 text-xs font-bold hover:bg-red-900/40 cursor-pointer"
                    >
                      Logout
                    </button>
                  </div>
                </div>

                {/* Event Galleries Manager Grid */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Your Managed Event Galleries ({galleries.length})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {galleries.map((gallery) => (
                      <div
                        key={gallery.id}
                        className="emerald-card p-5 rounded-2xl flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#00f59b]/10 text-[#00f59b] border border-[#00f59b]/30">
                              {gallery.status}
                            </span>
                            <span className="text-xs text-zinc-400 font-mono">
                              {gallery.photoCount} photos
                            </span>
                          </div>

                          <h4 className="font-bold text-base text-white pt-1">{gallery.title}</h4>
                          <p className="text-xs text-zinc-400">{gallery.clientName}</p>
                        </div>

                        {/* Action buttons */}
                        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#00f59b]/10">
                          <button
                            onClick={() => handleShowQR(gallery)}
                            className="py-2.5 rounded-xl bg-[#060b08] hover:bg-[#00f59b]/10 text-xs font-medium text-[#00f59b] border border-[#00f59b]/25 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>QR</span>
                          </button>

                          <button
                            onClick={() => handleWhatsAppShare(gallery.title, gallery.publicUrl)}
                            className="py-2.5 rounded-xl bg-[#060b08] hover:bg-emerald-950 text-xs font-medium text-emerald-400 border border-emerald-800/40 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Share</span>
                          </button>

                          <Link
                            href={`/admin/galleries/${gallery.id}`}
                            className="py-2.5 rounded-xl emerald-btn text-xs font-bold flex items-center justify-center gap-1"
                          >
                            <Upload className="w-3.5 h-3.5 text-black" />
                            <span>Upload</span>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer Branding */}
      <footer className="mt-12 border-t border-[#00f59b]/15 py-8 text-center space-y-2 relative z-10">
        <div className="flex items-center justify-center gap-2">
          <div className="w-5 h-5 rounded-md bg-[#00f59b] flex items-center justify-center text-black font-black text-[10px]">
            BA
          </div>
          <span className="font-extrabold text-sm tracking-tight text-white">BA Photo Vault</span>
          <span className="text-zinc-600">•</span>
          <span className="text-xs text-[#00f59b] font-semibold tracking-wider uppercase">LAXMAN M</span>
        </div>
        <p className="text-[11px] text-zinc-500">
          Ultra-Fast QR Event Delivery &amp; Secure Vault • All photos protected with LAXMAN M Watermark
        </p>
      </footer>

      {/* ============================================================== */}
      {/* CREATE EVENT MODAL                                             */}
      {/* ============================================================== */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm bg-[#0b1410] border border-[#00f59b]/40 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-white">Create Event Gallery</h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGallery} className="space-y-3">
              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-1">
                  Event Name *
                </label>
                <input
                  type="text"
                  required
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="e.g. Rahul & Priya Wedding"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-[#00f59b]/30 text-sm text-white focus:outline-none focus:border-[#00f59b]"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-1">
                  Client / Host Name
                </label>
                <input
                  type="text"
                  value={createClient}
                  onChange={(e) => setCreateClient(e.target.value)}
                  placeholder="e.g. Rahul & Priya Sharma"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-[#00f59b]/30 text-sm text-white focus:outline-none focus:border-[#00f59b]"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-1">
                  Gallery Passcode *
                </label>
                <input
                  type="text"
                  required
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="e.g. 1234"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-[#00f59b]/30 text-sm text-white focus:outline-none focus:border-[#00f59b] font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full mt-2 py-3 rounded-xl emerald-btn text-xs tracking-wider uppercase font-bold cursor-pointer shadow-lg"
              >
                {creating ? "Creating Event..." : "Create & Get QR Code"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* QR CODE POPUP MODAL                                            */}
      {/* ============================================================== */}
      {qrModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm bg-[#0b1410] border border-[#00f59b]/40 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#00f59b] uppercase tracking-wider">
                Event QR Code
              </span>
              <button
                onClick={() => {
                  setQrModalItem(null);
                  setQrPng(null);
                }}
                className="p-1 rounded-full text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="font-bold text-lg text-white">{qrModalItem.title}</h3>
              <p className="text-xs text-zinc-400">Scan to open and enter passcode</p>
            </div>

            {/* QR Card */}
            <div className="p-4 bg-white rounded-2xl mx-auto w-52 h-52 flex items-center justify-center shadow-lg">
              {qrPng ? (
                <img src={qrPng} alt="QR Code" className="w-full h-full object-contain" />
              ) : (
                <div className="w-8 h-8 border-2 border-[#00f59b] border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            {/* Quick Actions */}
            <div className="space-y-2 pt-2">
              <button
                onClick={() => handleWhatsAppShare(qrModalItem.title, qrModalItem.publicUrl)}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Share on WhatsApp</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleCopy(qrModalItem.publicUrl, qrModalItem.slug)}
                  className="py-2.5 rounded-xl bg-black/60 border border-[#00f59b]/30 text-xs text-zinc-200 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedSlug === qrModalItem.slug ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#00f59b]" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>

                <a
                  href={`/api/galleries/${qrModalItem.id}/qr?format=png`}
                  download={`qr-${qrModalItem.slug}.png`}
                  className="py-2.5 rounded-xl bg-black/60 border border-[#00f59b]/30 text-xs text-zinc-200 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#00f59b]" />
                  <span>Save QR</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
