"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Camera,
  Plus,
  Search,
  QrCode,
  Lock,
  Copy,
  Check,
  Download,
  Printer,
  Calendar,
  Image as ImageIcon,
  ExternalLink,
  Eye,
  HardDrive,
  LogOut,
  Settings,
  X,
  Key,
  Shield,
  Layers,
  Sparkles,
} from "lucide-react";

interface GalleryItem {
  id: string;
  slug: string;
  title: string;
  clientName: string;
  eventDate: string | null;
  description: string | null;
  status: string;
  expiresAt: string | null;
  allowDownloadOriginal: boolean;
  allowDownloadAll: boolean;
  viewsCount: number;
  photoCount: number;
  coverPhotoId: string | null;
  publicUrl: string;
  createdAt: string;
}

interface Stats {
  totalGalleries: number;
  totalPhotos: number;
  totalVisits: number;
  totalStorageBytes: number;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [owner, setOwner] = useState<any>(null);
  const [galleries, setGalleries] = useState<GalleryItem[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalGalleries: 0,
    totalPhotos: 0,
    totalVisits: 0,
    totalStorageBytes: 0,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [qrModalGallery, setQrModalGallery] = useState<GalleryItem | null>(null);
  const [qrData, setQrData] = useState<{ pngDataUrl: string; svgContent: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    clientName: "",
    eventDate: "",
    description: "",
    password: "",
    expiresAt: "",
    allowDownloadOriginal: true,
    allowDownloadAll: true,
  });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Helper: Fetch Dashboard Data
  const fetchData = async () => {
    try {
      // 1. Auth check
      const authRes = await fetch("/api/auth/me");
      const authData = await authRes.json();
      if (authData.needsSetup) {
        router.replace("/admin/setup");
        return;
      }
      if (!authData.authenticated) {
        router.replace("/admin/login");
        return;
      }
      setOwner(authData.owner);

      // 2. Fetch galleries
      const gallRes = await fetch("/api/galleries");
      const gallData = await gallRes.json();
      if (gallRes.ok) {
        setGalleries(gallData.galleries || []);
        setStats(gallData.stats || {
          totalGalleries: 0,
          totalPhotos: 0,
          totalVisits: 0,
          totalStorageBytes: 0,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [router]);

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleGeneratePassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$";
    let pwd = "";
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, password: pwd }));
  };

  const handleOpenQRModal = async (gallery: GalleryItem) => {
    setQrModalGallery(gallery);
    setQrLoading(true);
    try {
      const res = await fetch(`/api/galleries/${gallery.id}/qr?format=json`);
      const data = await res.json();
      setQrData({
        pngDataUrl: data.pngDataUrl,
        svgContent: data.svgContent,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setQrLoading(false);
    }
  };

  const handleCreateGallery = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setCreating(true);

    try {
      const res = await fetch("/api/galleries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create gallery.");
      }

      setCreateModalOpen(false);
      setFormData({
        title: "",
        clientName: "",
        eventDate: "",
        description: "",
        password: "",
        expiresAt: "",
        allowDownloadOriginal: true,
        allowDownloadAll: true,
      });

      await fetchData();
      // Open the QR code modal for the newly created gallery immediately!
      if (data.gallery) {
        handleOpenQRModal(data.gallery);
      }
    } catch (err: any) {
      setFormError(err.message || "Failed to create gallery.");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (gallery: GalleryItem) => {
    const newStatus = gallery.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    try {
      const res = await fetch(`/api/galleries/${gallery.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setGalleries((prev) =>
          prev.map((g) => (g.id === gallery.id ? { ...g, status: newStatus } : g))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const filteredGalleries = galleries.filter((g) => {
    const matchesSearch =
      g.title.toLowerCase().includes(search.toLowerCase()) ||
      g.clientName.toLowerCase().includes(search.toLowerCase()) ||
      g.slug.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || g.status.toUpperCase() === statusFilter.toUpperCase();

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa]">
      {/* Top Navbar */}
      <nav className="border-b border-zinc-800 bg-[#0d0d10] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/40 flex items-center justify-center text-[#d4af37]">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-serif text-lg font-semibold tracking-wider text-white">
                {owner?.studioName || "Lumière Studio"}
              </h1>
              <p className="text-[11px] text-zinc-400">
                Photographer Dashboard • {owner?.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              target="_blank"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 transition-colors"
            >
              <span>View Website</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>

            <Link
              href="/admin/settings"
              className="p-2 rounded-lg text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </Link>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 border border-red-900/50 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-6 py-10 space-y-10">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="p-6 rounded-2xl bg-[#121215] border border-zinc-800/80 shadow-lg">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs uppercase tracking-wider font-medium">Total Galleries</span>
              <Layers className="w-4 h-4 text-[#d4af37]" />
            </div>
            <p className="font-serif text-3xl font-bold text-white">{stats.totalGalleries}</p>
            <p className="text-[11px] text-zinc-500 mt-1">Multi-event collections online</p>
          </div>

          <div className="p-6 rounded-2xl bg-[#121215] border border-zinc-800/80 shadow-lg">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs uppercase tracking-wider font-medium">Photos Hosted</span>
              <ImageIcon className="w-4 h-4 text-[#d4af37]" />
            </div>
            <p className="font-serif text-3xl font-bold text-white">{stats.totalPhotos}</p>
            <p className="text-[11px] text-zinc-500 mt-1">Original & optimized WebP</p>
          </div>

          <div className="p-6 rounded-2xl bg-[#121215] border border-zinc-800/80 shadow-lg">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs uppercase tracking-wider font-medium">Storage Used</span>
              <HardDrive className="w-4 h-4 text-[#d4af37]" />
            </div>
            <p className="font-serif text-3xl font-bold text-white">
              {formatBytes(stats.totalStorageBytes)}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">High-resolution originals & cache</p>
          </div>

          <div className="p-6 rounded-2xl bg-[#121215] border border-zinc-800/80 shadow-lg">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs uppercase tracking-wider font-medium">Guest Visits</span>
              <Eye className="w-4 h-4 text-[#d4af37]" />
            </div>
            <p className="font-serif text-3xl font-bold text-white">{stats.totalVisits}</p>
            <p className="text-[11px] text-zinc-500 mt-1">QR scans & password unlocks</p>
          </div>
        </div>

        {/* Gallery Control Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by gallery name or client..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#121215] border border-zinc-800 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            <div className="flex items-center gap-1 bg-[#121215] p-1 rounded-xl border border-zinc-800">
              {["ALL", "ACTIVE", "DISABLED"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    statusFilter === tab
                      ? "bg-[#d4af37] text-black font-semibold"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              handleGeneratePassword();
              setCreateModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#aa8420] text-black font-semibold text-xs tracking-wider uppercase hover:opacity-95 transition-opacity cursor-pointer shadow-lg shadow-[#d4af37]/20"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Gallery</span>
          </button>
        </div>

        {/* Galleries Grid */}
        {filteredGalleries.length === 0 ? (
          <div className="text-center py-20 rounded-3xl bg-[#121215] border border-zinc-800/80 p-8 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
              <Camera className="w-7 h-7" />
            </div>
            <h3 className="font-serif text-xl text-white">No Photo Galleries Found</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              {search
                ? "No galleries match your search query."
                : "Create your first independent client gallery to generate unique QR codes and upload event photographs."}
            </p>
            {!search && (
              <button
                onClick={() => {
                  handleGeneratePassword();
                  setCreateModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#d4af37] text-black font-semibold text-xs uppercase cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Gallery Now</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGalleries.map((gallery) => (
              <div
                key={gallery.id}
                className="rounded-2xl bg-[#121215] border border-zinc-800 hover:border-[#d4af37]/50 transition-all shadow-xl overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Gallery Card Top / Cover */}
                  <div className="relative aspect-[16/9] bg-zinc-950 overflow-hidden border-b border-zinc-800/80">
                    {gallery.coverPhotoId ? (
                      <img
                        src={`/api/public/gallery/${gallery.slug}/photo/${gallery.coverPhotoId}?type=thumbnail&publicCover=true`}
                        alt={gallery.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-2">
                        <ImageIcon className="w-8 h-8" />
                        <span className="text-[11px]">No photos uploaded yet</span>
                      </div>
                    )}

                    {/* Status Pill */}
                    <div className="absolute top-3 left-3">
                      <span
                        className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full border ${
                          gallery.status === "ACTIVE"
                            ? "bg-emerald-950/80 text-emerald-400 border-emerald-800/80"
                            : "bg-zinc-900/80 text-zinc-400 border-zinc-700"
                        }`}
                      >
                        {gallery.status}
                      </span>
                    </div>

                    {/* Photo Count */}
                    <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg text-[11px] text-zinc-300 border border-zinc-800 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-[#d4af37]" />
                      <span>{gallery.photoCount} photos</span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="p-5 space-y-2">
                    <h3 className="font-serif text-xl font-medium text-white line-clamp-1">
                      {gallery.title}
                    </h3>
                    <p className="text-xs text-zinc-400 flex items-center gap-2">
                      <span className="text-[#d4af37] font-medium">{gallery.clientName}</span>
                      {gallery.eventDate && (
                        <>
                          <span>•</span>
                          <span>{new Date(gallery.eventDate).toLocaleDateString()}</span>
                        </>
                      )}
                    </p>

                    <div className="pt-2 flex items-center justify-between text-[11px] text-zinc-500 border-t border-zinc-800/60 mt-3">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {gallery.viewsCount} guest views
                      </span>
                      <span>Slug: /{gallery.slug}</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="p-4 bg-zinc-950/60 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenQRModal(gallery)}
                      className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-[#d4af37] border border-zinc-800 transition-colors cursor-pointer"
                      title="View & Download QR Code"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCopyLink(gallery.publicUrl, gallery.id)}
                      className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors cursor-pointer relative"
                      title="Copy Public Link"
                    >
                      {copiedId === gallery.id ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleToggleStatus(gallery)}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-[10px] text-zinc-400 border border-zinc-800 transition-colors cursor-pointer"
                      title="Toggle active status"
                    >
                      {gallery.status === "ACTIVE" ? "Disable" : "Enable"}
                    </button>
                  </div>

                  <Link
                    href={`/admin/galleries/${gallery.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#d4af37] text-black font-semibold text-xs uppercase hover:bg-[#e5c07b] transition-colors"
                  >
                    <span>Manage</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Gallery Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="relative w-full max-w-lg bg-[#121215] border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl my-8">
            <button
              onClick={() => setCreateModalOpen(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <div className="w-12 h-12 rounded-2xl bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center mb-3 text-[#d4af37]">
                <Plus className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-2xl text-white font-medium">Create New QR Gallery</h3>
              <p className="text-xs text-zinc-400 mt-1">
                A dedicated, independent collection with its own QR code, secure password, and download controls.
              </p>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-800 text-red-200 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateGallery} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-medium mb-1">
                  Gallery Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Rahul & Priya Wedding"
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-white focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-zinc-400 font-medium mb-1">
                    Customer / Event Host *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    placeholder="e.g. Rahul & Priya Sharma"
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-white focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-zinc-400 font-medium mb-1">
                    Event Date
                  </label>
                  <input
                    type="date"
                    value={formData.eventDate}
                    onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-white focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs uppercase tracking-wider text-zinc-400 font-medium">
                    Gallery Access Password *
                  </label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-[11px] text-[#d4af37] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Key className="w-3 h-3" /> Generate Password
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="e.g. wedding2026 or secure pass"
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-white focus:outline-none focus:border-[#d4af37] font-mono"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-medium mb-1">
                  Welcome Note / Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Welcome to our wedding gallery! Feel free to download high-resolution photos..."
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-white focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-zinc-400 font-medium mb-1">
                  Optional Gallery Expiration Date
                </label>
                <input
                  type="date"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-white focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <label className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allowDownloadOriginal}
                    onChange={(e) =>
                      setFormData({ ...formData, allowDownloadOriginal: e.target.checked })
                    }
                    className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-[#d4af37] focus:ring-[#d4af37]"
                  />
                  <span>Allow guests to download individual original-quality photos</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allowDownloadAll}
                    onChange={(e) =>
                      setFormData({ ...formData, allowDownloadAll: e.target.checked })
                    }
                    className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-[#d4af37] focus:ring-[#d4af37]"
                  />
                  <span>Allow guests to download full-collection ZIP archive</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full mt-4 py-3.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#aa8420] text-black font-semibold text-xs tracking-wider uppercase hover:opacity-95 transition-opacity cursor-pointer shadow-lg shadow-[#d4af37]/20 flex items-center justify-center gap-2"
              >
                {creating ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Generate Gallery & QR Code</span>
                    <QrCode className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Preview & Download Modal */}
      {qrModalGallery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-[#121215] border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
            <button
              onClick={() => {
                setQrModalGallery(null);
                setQrData(null);
              }}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <h3 className="font-serif text-2xl text-white font-medium">Gallery QR Code</h3>
              <p className="text-xs text-[#d4af37] mt-0.5">{qrModalGallery.title}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Client: {qrModalGallery.clientName}</p>
            </div>

            {qrLoading || !qrData ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Printable Display Card */}
                <div
                  id="printable-qr-card"
                  className="p-6 rounded-2xl bg-white text-black text-center shadow-xl border-4 border-[#d4af37] space-y-4"
                >
                  <div>
                    <p className="font-serif text-lg font-bold tracking-widest uppercase">
                      {owner?.studioName || "LUMIÈRE"}
                    </p>
                    <p className="text-[9px] tracking-widest uppercase text-zinc-600">
                      Fine Art Photography
                    </p>
                  </div>

                  <div className="w-48 h-48 mx-auto bg-white p-2 rounded-xl border border-zinc-200">
                    <img
                      src={qrData.pngDataUrl}
                      alt="Gallery QR Code"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div>
                    <h4 className="font-serif text-base font-bold text-black">
                      {qrModalGallery.title}
                    </h4>
                    <p className="text-[11px] text-zinc-700 mt-1">
                      Scan with your smartphone camera to view and download our celebration photographs.
                    </p>
                  </div>
                </div>

                {/* Direct Link */}
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
                  <span className="text-zinc-500 truncate flex-1 font-mono">
                    {qrModalGallery.publicUrl}
                  </span>
                  <button
                    onClick={() => handleCopyLink(qrModalGallery.publicUrl, qrModalGallery.id)}
                    className="p-1.5 text-zinc-400 hover:text-white"
                    title="Copy Link"
                  >
                    {copiedId === qrModalGallery.id ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Download Actions */}
                <div className="grid grid-cols-3 gap-2">
                  <a
                    href={`/api/galleries/${qrModalGallery.id}/qr?format=png`}
                    download={`qr-${qrModalGallery.slug}.png`}
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-[#d4af37] text-zinc-200 hover:text-white text-center transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-[#d4af37] mb-1" />
                    <span className="text-[11px] font-medium">PNG High-Res</span>
                  </a>

                  <a
                    href={`/api/galleries/${qrModalGallery.id}/qr?format=svg`}
                    download={`qr-${qrModalGallery.slug}.svg`}
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-[#d4af37] text-zinc-200 hover:text-white text-center transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-[#d4af37] mb-1" />
                    <span className="text-[11px] font-medium">Vector SVG</span>
                  </a>

                  <button
                    onClick={() => window.print()}
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-[#d4af37] text-zinc-200 hover:text-white text-center transition-all cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-[#d4af37] mb-1" />
                    <span className="text-[11px] font-medium">Print Stand</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
