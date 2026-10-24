"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  Camera,
  QrCode,
  Lock,
  Copy,
  Check,
  Download,
  Trash2,
  Star,
  ExternalLink,
  Share2,
  Save,
  AlertTriangle,
} from "lucide-react";

interface PhotoItem {
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
  downloadUrl: string;
}

interface GalleryData {
  id: string;
  slug: string;
  title: string;
  clientName: string;
  eventDate: string | null;
  description: string | null;
  coverPhotoId: string | null;
  status: string;
  expiresAt: string | null;
  allowDownloadOriginal: boolean;
  allowDownloadAll: boolean;
  viewsCount: number;
  publicUrl: string;
  qrCodePng: string;
  qrCodeSvg: string;
  totalStorageBytes: number;
  photos: PhotoItem[];
}

export default function ZeBeyondGalleryManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);

  const [gallery, setGallery] = useState<GalleryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newClient, setNewClient] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [allowDownload, setAllowDownload] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchGallery = async () => {
    try {
      const res = await fetch(`/api/galleries/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load gallery.");

      setGallery(data.gallery);
      setNewTitle(data.gallery.title);
      setNewClient(data.gallery.clientName);
      setAllowDownload(data.gallery.allowDownloadOriginal);
    } catch (err: any) {
      setError(err.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGallery();
  }, [id]);

  const handleCopy = () => {
    if (!gallery) return;
    navigator.clipboard.writeText(gallery.publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsApp = () => {
    if (!gallery) return;
    const text = encodeURIComponent(`📸 View your event photos for "${gallery.title}": ${gallery.publicUrl}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0 || !gallery) return;

    setUploading(true);
    setUploadProgress(25);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    try {
      setUploadProgress(65);
      const res = await fetch(`/api/galleries/${gallery.id}/photos`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed.");
      setUploadProgress(100);
      await fetchGallery();
    } catch (err: any) {
      alert(err.message || "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSetCover = async (photoId: string) => {
    if (!gallery) return;
    try {
      await fetch(`/api/galleries/${gallery.id}/photos/${photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCover: true }),
      });
      await fetchGallery();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!gallery) return;
    if (!confirm("Delete this photo?")) return;

    try {
      await fetch(`/api/galleries/${gallery.id}/photos/${photoId}`, {
        method: "DELETE",
      });
      await fetchGallery();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gallery) return;
    setSavingSettings(true);
    setSettingsMsg(null);

    try {
      const payload: any = {
        title: newTitle.trim(),
        clientName: newClient.trim(),
        allowDownloadOriginal: allowDownload,
        allowDownloadAll: allowDownload,
      };
      if (newPassword.trim().length >= 4) {
        payload.password = newPassword.trim();
      }

      const res = await fetch(`/api/galleries/${gallery.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to update settings.");
      setSettingsMsg("Saved successfully!");
      setNewPassword("");
      await fetchGallery();
    } catch (err: any) {
      setSettingsMsg(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteGallery = async () => {
    if (!gallery) return;
    setDeleting(true);
    try {
      await fetch(`/api/galleries/${gallery.id}`, { method: "DELETE" });
      router.push("/");
    } catch (err: any) {
      alert(err.message);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060b08] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#00f59b] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !gallery) {
    return (
      <div className="min-h-screen bg-[#060b08] flex flex-col items-center justify-center text-center p-6 text-white max-w-sm mx-auto">
        <AlertTriangle className="w-12 h-12 text-red-400 mb-2" />
        <h2 className="text-xl font-bold">Event Not Found</h2>
        <Link href="/" className="mt-4 px-6 py-2.5 rounded-xl bg-zinc-800 text-xs">
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060b08] text-[#f0fdf4] flex flex-col justify-between max-w-xl mx-auto border-x border-[#00f59b]/15 pb-16">
      {/* Header */}
      <header className="p-4 border-b border-[#00f59b]/15 bg-[#060b08]/95 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Link href="/" className="p-2 rounded-xl bg-[#0b1410] border border-[#00f59b]/25 text-zinc-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-sm font-bold text-white line-clamp-1">{gallery.title}</h1>
            <p className="text-[10px] text-zinc-400">{gallery.clientName} • Manage Event</p>
          </div>
        </div>

        <Link
          href={`/g/${gallery.slug}`}
          target="_blank"
          className="emerald-btn px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow-md"
        >
          <span>Preview</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </header>

      {/* Main Body */}
      <main className="p-4 space-y-6">
        {/* QR Code Presentation Box */}
        <div className="emerald-card p-5 rounded-3xl space-y-4 text-center">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#00f59b]">
              Event QR Code
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">/{gallery.slug}</span>
          </div>

          <div className="p-3 bg-white rounded-2xl mx-auto w-44 h-44 flex items-center justify-center shadow-md">
            <img src={gallery.qrCodePng} alt="QR Code" className="w-full h-full object-contain" />
          </div>

          <div className="space-y-2">
            <button
              onClick={handleWhatsApp}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Share2 className="w-4 h-4" />
              <span>Share on WhatsApp</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopy}
                className="py-2.5 rounded-xl bg-black/60 border border-[#00f59b]/30 text-xs text-zinc-200 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-[#00f59b]" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? "Copied!" : "Copy Link"}</span>
              </button>

              <a
                href={`/api/galleries/${gallery.id}/qr?format=png`}
                download={`qr-${gallery.slug}.png`}
                className="py-2.5 rounded-xl bg-black/60 border border-[#00f59b]/30 text-xs text-zinc-200 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#00f59b]" />
                <span>Save QR</span>
              </a>
            </div>
          </div>
        </div>

        {/* Upload Button */}
        <div className="p-5 rounded-3xl bg-[#0b1410] border border-[#00f59b]/25 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#00f59b]/10 border border-[#00f59b]/30 flex items-center justify-center mx-auto text-[#00f59b]">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Add Photographs</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Select multiple photos from your Android gallery or camera.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />

          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3.5 rounded-xl emerald-btn text-xs font-bold uppercase tracking-wider shadow-lg shadow-[#00f59b]/20 cursor-pointer"
          >
            {uploading ? `Processing Photos (${uploadProgress}%)...` : "Select Photos to Upload"}
          </button>
        </div>

        {/* Uploaded Photos Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Uploaded Photos ({gallery.photos.length})
            </span>
          </div>

          {gallery.photos.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#0b1410] border border-[#00f59b]/15 text-center text-xs text-zinc-500">
              No photos uploaded yet. Tap the button above to upload.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {gallery.photos.map((photo) => (
                <div
                  key={photo.id}
                  className={`group relative aspect-square rounded-2xl overflow-hidden bg-black/60 border ${
                    photo.isCover ? "border-[#00f59b] ring-2 ring-[#00f59b]/20" : "border-[#00f59b]/20"
                  }`}
                >
                  <img
                    src={photo.thumbnailUrl}
                    alt={photo.filename}
                    className="w-full h-full object-cover"
                  />

                  {photo.isCover && (
                    <div className="absolute top-2 left-2 bg-[#00f59b] text-black text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                      <Star className="w-3 h-3 fill-black" />
                      <span>Cover</span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {!photo.isCover && (
                      <button
                        onClick={() => handleSetCover(photo.id)}
                        className="p-2 rounded-xl bg-[#00f59b] text-black cursor-pointer"
                        title="Set Cover"
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeletePhoto(photo.id)}
                      className="p-2 rounded-xl bg-red-950 text-red-300 border border-red-800 cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Settings Card */}
        <div className="emerald-card p-5 rounded-3xl space-y-4">
          <h3 className="font-bold text-sm text-white">Event Passcode & Settings</h3>

          {settingsMsg && (
            <div className="p-2.5 rounded-xl bg-black/50 border border-[#00f59b]/50 text-xs text-[#00f59b]">
              {settingsMsg}
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">
                Event Title
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-[#00f59b]/30 text-sm text-white focus:outline-none focus:border-[#00f59b]"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">
                Client / Host Name
              </label>
              <input
                type="text"
                required
                value={newClient}
                onChange={(e) => setNewClient(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-[#00f59b]/30 text-sm text-white focus:outline-none focus:border-[#00f59b]"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">
                Change Passcode (e.g. 1234)
              </label>
              <input
                type="text"
                placeholder="Leave blank to keep existing"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-[#00f59b]/30 text-sm text-white focus:outline-none focus:border-[#00f59b] font-mono"
              />
            </div>

            <label className="flex items-center gap-2.5 text-xs text-zinc-300 py-1 cursor-pointer">
              <input
                type="checkbox"
                checked={allowDownload}
                onChange={(e) => setAllowDownload(e.target.checked)}
                className="w-4 h-4 rounded text-[#00f59b] bg-black border-[#00f59b]/40"
              />
              <span>Allow guests to download original photos</span>
            </label>

            <button
              type="submit"
              disabled={savingSettings}
              className="w-full py-3 rounded-xl emerald-btn text-xs font-bold uppercase cursor-pointer"
            >
              {savingSettings ? "Saving..." : "Save Settings"}
            </button>
          </form>

          <div className="pt-2 border-t border-[#00f59b]/15">
            <button
              onClick={() => setDeleteModalOpen(true)}
              className="w-full py-2.5 rounded-xl bg-red-950/40 text-red-400 border border-red-900/60 text-xs font-bold hover:bg-red-900/40 cursor-pointer"
            >
              Delete Event Gallery
            </button>
          </div>
        </div>
      </main>

      {/* Delete Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-xs bg-[#0b1410] border border-red-900/60 rounded-3xl p-5 shadow-2xl text-center space-y-3">
            <h3 className="font-bold text-base text-white">Delete This Event?</h3>
            <p className="text-xs text-zinc-400">
              Permanently deletes "{gallery.title}" and all its photos.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="py-2 rounded-xl bg-zinc-900 text-xs text-zinc-300"
              >
                Cancel
              </button>
              <button
                disabled={deleting}
                onClick={handleDeleteGallery}
                className="py-2 rounded-xl bg-red-700 text-xs font-bold text-white"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
