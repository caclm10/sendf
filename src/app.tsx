import { useState, useEffect } from "react";
import {
    FileText,
    Image as ImageIcon,
    Video as VideoIcon,
    Music as AudioIcon,
    File as FileIcon,
    Archive as ZipIcon,
    Code as CodeIcon,
    FileSpreadsheet as SheetIcon,
    ArrowLeft,
    Clock,
    Download,
    AlertCircle,
    CheckCircle,
    Eye,
    Trash2,
    Paperclip,
    Smartphone,
    Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Dropzone } from "@app/components/dropzone";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@app/components/ui/card";

// Format size helper
const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Format date helper
const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

// Map file type to relevant Lucide icon
const getFileIcon = (mimeType: string) => {
    const type = mimeType.toLowerCase();

    if (type.includes("pdf"))
        return <FileText className="w-12 h-12 text-primary" />;
    if (
        type.includes("word") ||
        type.includes("document") ||
        type.includes("text/plain") ||
        type.includes("rtf")
    ) {
        return <FileText className="w-12 h-12 text-primary" />;
    }
    if (type.includes("image/"))
        return <ImageIcon className="w-12 h-12 text-primary" />;
    if (type.includes("video/"))
        return <VideoIcon className="w-12 h-12 text-primary" />;
    if (type.includes("audio/"))
        return <AudioIcon className="w-12 h-12 text-primary" />;
    if (
        type.includes("zip") ||
        type.includes("compressed") ||
        type.includes("tar") ||
        type.includes("rar") ||
        type.includes("7z")
    ) {
        return <ZipIcon className="w-12 h-12 text-primary" />;
    }
    if (
        type.includes("spreadsheet") ||
        type.includes("excel") ||
        type.includes("csv") ||
        type.includes("sheets")
    ) {
        return <SheetIcon className="w-12 h-12 text-primary" />;
    }
    if (
        type.includes("json") ||
        type.includes("javascript") ||
        type.includes("typescript") ||
        type.includes("html") ||
        type.includes("css") ||
        type.includes("xml")
    ) {
        return <CodeIcon className="w-12 h-12 text-primary" />;
    }
    return <FileIcon className="w-12 h-12 text-primary" />;
};

function App() {
    const [viewMode, setViewMode] = useState<"upload" | "download" | "404">("upload");
    const [activeFileId, setActiveFileId] = useState<string | null>(null);

    // Download flow states
    const [downloadMeta, setDownloadMeta] = useState<any | null>(null);
    const [isLoadingMeta, setIsLoadingMeta] = useState(false);
    const [metaError, setMetaError] = useState<string | null>(null);
    const [downloadSuccessMessage, setDownloadSuccessMessage] = useState(false);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    // Deletion states in download view
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Save to gallery states
    const [isSavingToGallery, setIsSavingToGallery] = useState(false);
    const [canShareFiles, setCanShareFiles] = useState(false);

    // Sync timeLeft with downloadMeta
    useEffect(() => {
        if (
            downloadMeta &&
            downloadMeta.timeRemaining !== null &&
            downloadMeta.timeRemaining !== undefined
        ) {
            setTimeLeft(downloadMeta.timeRemaining);
        } else {
            setTimeLeft(null);
        }
    }, [downloadMeta]);

    // Live countdown timer ticking down every second
    useEffect(() => {
        if (timeLeft === null || timeLeft <= 0) return;

        const countdownInterval = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev === null || prev <= 1000) {
                    clearInterval(countdownInterval);
                    setMetaError(
                        "This file has expired after the 1-hour time limit."
                    );
                    return 0;
                }
                return prev - 1000;
            });
        }, 1000);

        return () => clearInterval(countdownInterval);
    }, [timeLeft]);

    const formatTimeRemaining = (ms: number): string => {
        if (ms <= 0) return "Expired";
        const totalSecs = Math.floor(ms / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        return `${mins}m ${secs}s`;
    };

    // Routing check on pathname change
    const checkRoute = () => {
        const path = window.location.pathname;
        const pathSegments = path.split("/").filter(Boolean);

        if (pathSegments.length === 0) {
            setActiveFileId(null);
            setDownloadMeta(null);
            setMetaError(null);
            setViewMode("upload");
        } else if (
            pathSegments.length === 1 &&
            /^([0-9a-z]{6}|[0-9a-z]{12})$/i.test(pathSegments[0])
        ) {
            const fileId = pathSegments[0];
            setActiveFileId(fileId);
            setViewMode("download");
            fetchFileMetadata(fileId);
        } else {
            setActiveFileId(null);
            setDownloadMeta(null);
            setMetaError(null);
            setViewMode("404");
        }
    };

    useEffect(() => {
        checkRoute();

        // Handle back & forward browser navigation
        const handlePopState = () => {
            checkRoute();
        };
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    // Soft SPA navigation
    const navigateTo = (path: string) => {
        window.history.pushState({}, "", path);
        checkRoute();
    };

    // Fetch metadata
    const fetchFileMetadata = async (id: string) => {
        setIsLoadingMeta(true);
        setMetaError(null);
        try {
            const res = await fetch(`/api/files/${id}/meta`);
            if (!res.ok) {
                if (res.status === 404) {
                    throw new Error(
                        "File not found or the link has expired."
                    );
                }
                throw new Error("Failed to retrieve file information.");
            }
            const data = await res.json();
            setDownloadMeta(data);
        } catch (err: any) {
            console.error(err);
            setMetaError(
                err.message || "An error occurred while loading the file."
            );
        } finally {
            setIsLoadingMeta(false);
        }
    };

    // Download execution
    const handleDownloadFile = () => {
        if (!downloadMeta) return;

        window.location.href = `/api/files/${downloadMeta.id}/download`;
        setDownloadSuccessMessage(true);

        setTimeout(() => {
            navigateTo("/");
        }, 2000);
    };

    // Check if file is image or video
    const isMediaFile = (type: string | undefined): boolean => {
        if (!type) return false;
        return type.startsWith("image/") || type.startsWith("video/");
    };

    // Check if browser supports sharing files (iOS Safari 15+, Chrome Android)
    useEffect(() => {
        if (downloadMeta && isMediaFile(downloadMeta.type) && navigator.canShare) {
            const testFile = new File(["test"], "test.png", { type: "image/png" });
            setCanShareFiles(navigator.canShare({ files: [testFile] }));
        } else {
            setCanShareFiles(false);
        }
    }, [downloadMeta]);

    // Save to gallery via Web Share API (fetches from /download, triggers one-time delete)
    const handleSaveToGallery = async () => {
        if (!downloadMeta) return;
        setIsSavingToGallery(true);

        try {
            const res = await fetch(`/api/files/${downloadMeta.id}/download`);
            if (!res.ok) throw new Error("Failed to fetch file.");

            const blob = await res.blob();
            const file = new File([blob], downloadMeta.name, {
                type: downloadMeta.type || "application/octet-stream",
            });

            await navigator.share({ files: [file] });

            // Redirect home since file is now deleted from server
            setTimeout(() => navigateTo("/"), 1000);
        } catch (err: any) {
            // User cancelled share sheet — that's fine, file was already fetched
            if (err.name !== "AbortError") {
                console.error("Save to gallery failed:", err);
            }
            // Still redirect since the fetch already triggered deletion
            setTimeout(() => navigateTo("/"), 1000);
        } finally {
            setIsSavingToGallery(false);
        }
    };

    // Manual delete file execution
    const handleDeleteFile = async (id: string, redirectHome = true) => {
        setIsDeleting(true);
        setDeleteError(null);
        try {
            const res = await fetch(`/api/files/${id}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                throw new Error("Failed to delete the file from the server.");
            }
            setShowDeleteConfirm(false);
            if (redirectHome) {
                navigateTo("/");
            } else {
                setDownloadMeta(null);
                setMetaError("The file has been permanently deleted.");
            }
        } catch (err: any) {
            console.error(err);
            setDeleteError(
                err.message || "An error occurred while deleting the file."
            );
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="min-h-dvh flex flex-col font-sans">
            {/* Header top colored bar */}
            <div className="h-1.5 bg-primary w-full" />

            {/* Main Content Area */}
            <div className="container max-w-xl mx-auto px-5 py-10 flex flex-col gap-6 flex-1 justify-center">
                {/* Logo & Branding Header */}
                <header className="text-center flex flex-col gap-2.5 items-center">
                    <button
                        onClick={() => navigateTo("/")}
                        className="flex items-center gap-3 transition-transform duration-200 active:scale-95 mb-1 focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-lg p-1.5 cursor-pointer"
                    >
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-sm">
                            <Paperclip className="w-5.5 h-5.5" />
                        </div>
                        <h1 className="text-3xl text-primary font-extrabold tracking-tight">
                            sendf
                        </h1>
                    </button>
                    <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                        Share files instantly and securely. Simple, fast,
                        and easy to use anytime.
                    </p>
                </header>

                <Card className="shadow-md border-border/80">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-xl font-bold">
                            {viewMode === "upload"
                                ? "Upload File"
                                : viewMode === "download"
                                ? "Download File"
                                : "Halaman Tidak Ditemukan"}
                        </CardTitle>
                        <CardDescription className="text-xs">
                            {viewMode === "upload"
                                ? "Select or drag your file to the area below to get started."
                                : viewMode === "download"
                                ? "Details of the secure file shared with you."
                                : "Tautan yang Anda tuju tidak valid atau telah kedaluwarsa."}
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <AnimatePresence mode="wait">
                            {viewMode === "upload" ? (
                                /* Upload Mode */
                                <motion.div
                                    key="upload-view"
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <Dropzone />
                                </motion.div>
                            ) : viewMode === "download" ? (
                                /* Recipient Download Mode */
                                <motion.div
                                    key="download-view"
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    {isLoadingMeta ? (
                                        <div className="py-12 flex flex-col items-center justify-center text-center">
                                            <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                                            <p className="text-xs text-muted-foreground">
                                                Loading file details from the server...
                                            </p>
                                        </div>
                                    ) : metaError ? (
                                        <div className="text-center py-6">
                                            <div className="w-12 h-12 bg-destructive/10 border border-destructive/20 rounded-full flex items-center justify-center text-destructive mx-auto mb-4">
                                                <AlertCircle className="w-6 h-6" />
                                            </div>
                                            <h3 className="text-base font-bold text-foreground mb-2">
                                                File Not Found
                                            </h3>
                                            <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-6 leading-relaxed">
                                                {metaError} The link may be mistyped
                                                or the owner has deleted this file.
                                            </p>
                                            <button
                                                onClick={() => navigateTo("/")}
                                                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm cursor-pointer"
                                            >
                                                Go to Home Page
                                            </button>
                                        </div>
                                    ) : (
                                        downloadMeta && (
                                            <div>
                                                <div className="flex items-center justify-between pb-3 border-b border-border/80 mb-5">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                        File Receipt
                                                    </span>
                                                    <button
                                                        onClick={() => navigateTo("/")}
                                                        className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline cursor-pointer"
                                                    >
                                                        <ArrowLeft className="w-3 h-3" />
                                                        Home
                                                    </button>
                                                </div>

                                                {/* File Receipt Box */}
                                                <div className="flex flex-col items-center text-center mb-6 py-4 px-3 bg-muted/30 border border-border rounded-xl">
                                                    <div className="p-3 bg-card border border-border rounded-xl shadow-xs mb-3">
                                                        {getFileIcon(downloadMeta.type)}
                                                    </div>
                                                    <h3 className="text-sm font-bold text-foreground px-4 break-all max-w-full">
                                                        {downloadMeta.name}
                                                    </h3>
                                                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                                                        {formatSize(downloadMeta.size)}
                                                    </p>
                                                </div>

                                                {/* Meta Details List */}
                                                <div className="space-y-2.5 text-xs mb-6 px-1">
                                                    <div className="flex justify-between py-1.5 border-b border-muted">
                                                        <span className="text-muted-foreground flex items-center gap-1.5">
                                                            <Clock className="w-3.5 h-3.5 text-primary" />
                                                            Upload Date
                                                        </span>
                                                        <span className="font-semibold text-foreground">
                                                            {formatDate(downloadMeta.uploadedAt)}
                                                        </span>
                                                    </div>

                                                    <div className="flex justify-between py-1.5 border-b border-muted">
                                                        <span className="text-muted-foreground flex items-center gap-1.5">
                                                            <Eye className="w-3.5 h-3.5 text-primary" />
                                                            Downloaded
                                                        </span>
                                                        <span className="font-mono font-semibold text-foreground">
                                                            {downloadMeta.downloadsCount} time{downloadMeta.downloadsCount !== 1 ? "s" : ""}
                                                        </span>
                                                    </div>


                                                </div>

                                                {/* Auto-delete notice */}
                                                <div className="mb-5 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-left flex items-start gap-2.5 text-xs text-amber-850 dark:text-amber-300 leading-relaxed">
                                                    <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                                                    <div>
                                                        <span className="font-bold block mb-0.5">
                                                            Auto-Delete After Download
                                                        </span>
                                                        This file will be permanently deleted from the server once you download it. Make sure your download completes successfully.
                                                    </div>
                                                </div>

                                                {/* Download Button */}
                                                <button
                                                    onClick={handleDownloadFile}
                                                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                                                >
                                                    <Download className="w-4 h-4" />
                                                    Download File Now
                                                </button>

                                                {/* Save to Gallery button — only for image/video + browser supports share */}
                                                {isMediaFile(downloadMeta.type) && canShareFiles && (
                                                    <>
                                                        <button
                                                            onClick={handleSaveToGallery}
                                                            disabled={isSavingToGallery}
                                                            className="w-full mt-2.5 bg-card hover:bg-muted text-foreground border border-border py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                                                        >
                                                            {isSavingToGallery ? (
                                                                <>
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                    Preparing...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Smartphone className="w-4 h-4" />
                                                                    Save to Gallery
                                                                </>
                                                            )}
                                                        </button>
                                                        <p className="text-[10px] text-muted-foreground text-center mt-1 leading-relaxed">
                                                            Opens the share menu — tap <span className="font-semibold">"Save {downloadMeta.type?.startsWith("image/") ? "Image" : "Video"}"</span> to save to your gallery.
                                                        </p>
                                                    </>
                                                )}

                                                {/* Download triggered toast */}
                                                {downloadSuccessMessage && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 4 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        className="mt-4 flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-600 dark:text-emerald-400 text-xs"
                                                    >
                                                        <CheckCircle className="w-4 h-4" />
                                                        <span>
                                                            Download started. Please check your browser!
                                                        </span>
                                                    </motion.div>
                                                )}

                                                {/* Sender deletion panel inside download page */}
                                                <div className="mt-6 pt-4 border-t border-border flex flex-col items-center">
                                                    {showDeleteConfirm ? (
                                                        <div className="w-full p-3 bg-destructive/5 border border-destructive/20 rounded-xl text-left">
                                                            <p className="text-xs font-semibold text-destructive mb-1">
                                                                Confirm Permanent Deletion
                                                            </p>
                                                            <p className="text-[10px] text-muted-foreground leading-relaxed mb-3">
                                                                Are you sure you want to permanently delete this file from the server? It will no longer be available for download.
                                                            </p>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => handleDeleteFile(downloadMeta.id, false)}
                                                                    disabled={isDeleting}
                                                                    className="px-3 py-1.5 bg-destructive hover:bg-destructive/95 text-destructive-foreground text-[10px] font-semibold rounded-lg shrink-0 transition-colors disabled:opacity-50 cursor-pointer"
                                                                >
                                                                    {isDeleting ? "Deleting..." : "Yes, Delete Now"}
                                                                </button>
                                                                <button
                                                                    onClick={() => setShowDeleteConfirm(false)}
                                                                    className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-muted-foreground text-[10px] font-semibold rounded-lg transition-colors cursor-pointer"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                            {deleteError && (
                                                                <p className="text-[10px] text-destructive mt-2">
                                                                    {deleteError}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setShowDeleteConfirm(true)}
                                                            className="text-[10px] text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                                                        >
                                                            Delete this file from the server permanently
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    )}
                                </motion.div>
                            ) : (
                                /* 404 Not Found View */
                                <motion.div
                                    key="404-view"
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    transition={{ duration: 0.2 }}
                                    className="text-center py-8"
                                >
                                    <div className="w-16 h-16 bg-destructive/10 border border-destructive/20 rounded-full flex items-center justify-center text-destructive mx-auto mb-4 animate-bounce">
                                        <AlertCircle className="w-8 h-8" />
                                    </div>
                                    <h3 className="text-lg font-bold text-foreground mb-2">
                                        404 - Halaman Tidak Ditemukan
                                    </h3>
                                    <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-6 leading-relaxed">
                                        Tautan yang Anda tuju salah, telah dihapus oleh pengirim, atau sudah kedaluwarsa setelah 1 jam.
                                    </p>
                                    <button
                                        onClick={() => navigateTo("/")}
                                        className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors shadow-sm cursor-pointer"
                                    >
                                        Kembali ke Beranda
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export { App };
export default App;
