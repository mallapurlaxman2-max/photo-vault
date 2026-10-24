-- ====================================================================
-- Lumière Photography Platform - Complete Supabase PostgreSQL Schema
-- ====================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Owner Table
CREATE TABLE IF NOT EXISTS public."Owner" (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    email TEXT NOT NULL UNIQUE,
    "passwordHash" TEXT NOT NULL,
    name TEXT NOT NULL,
    "studioName" TEXT NOT NULL DEFAULT 'Lumière Fine Art Photography',
    tagline TEXT NOT NULL DEFAULT 'Capturing Timeless Moments into Eternal Art',
    bio TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "websiteUrl" TEXT,
    instagram TEXT,
    "storageLimitBytes" BIGINT NOT NULL DEFAULT 10737418240, -- 10 GB
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3. Gallery Table
CREATE TABLE IF NOT EXISTS public."Gallery" (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "eventDate" TIMESTAMP WITH TIME ZONE,
    description TEXT,
    "passwordHash" TEXT NOT NULL,
    "coverPhotoId" TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, EXPIRED, DISABLED
    "expiresAt" TIMESTAMP WITH TIME ZONE,
    "allowDownloadOriginal" BOOLEAN NOT NULL DEFAULT TRUE,
    "allowDownloadAll" BOOLEAN NOT NULL DEFAULT TRUE,
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gallery_slug ON public."Gallery"(slug);
CREATE INDEX IF NOT EXISTS idx_gallery_status ON public."Gallery"(status);

-- 4. Photo Table
CREATE TABLE IF NOT EXISTS public."Photo" (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    "galleryId" TEXT NOT NULL REFERENCES public."Gallery"(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "thumbnailKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    caption TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photo_gallery ON public."Photo"("galleryId");
CREATE INDEX IF NOT EXISTS idx_photo_sort ON public."Photo"("sortOrder");

-- 5. Access Log Table
CREATE TABLE IF NOT EXISTS public."AccessLog" (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    "galleryId" TEXT NOT NULL REFERENCES public."Gallery"(id) ON DELETE CASCADE,
    "ipHash" TEXT,
    "userAgent" TEXT,
    status TEXT NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_log_gallery ON public."AccessLog"("galleryId");

-- 6. Rate Limit Table
CREATE TABLE IF NOT EXISTS public."RateLimitRecord" (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    key TEXT NOT NULL UNIQUE,
    attempts INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP WITH TIME ZONE,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- Supabase Storage Bucket Setup
-- ====================================================================
-- In Supabase Dashboard -> Storage:
-- Create a private bucket named 'galleries'.
-- Storage RLS ensures unauthenticated users cannot read raw photos directly:
-- Photos are retrieved either through backend signed URLs or authenticated proxy.
