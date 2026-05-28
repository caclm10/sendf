import { useId, useRef, useState, useEffect } from "react";
import {
    Upload,
    FileText,
    Image as ImageIcon,
    Video as VideoIcon,
    Music as AudioIcon,
    File as FileIcon,
    Archive as ZipIcon,
    Code as CodeIcon,
    FileSpreadsheet as SheetIcon,
    Copy,
    Check,
    AlertCircle,
    ArrowLeft,
    HardDrive,
    CheckCircle,
    QrCode as QrIcon,
    Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import QRCode from "qrcode";

// Format size helper
const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Map file type to relevant Lucide icon
const getFileIcon = (mimeType: string) => {
    const type = mimeType.toLowerCase();

    if (type.includes("pdf"))
        return <FileText id="icon-pdf" className="w-12 h-12 text-primary" />;
    if (
        type.includes("word") ||
        type.includes("document") ||
        type.includes("text/plain") ||
        type.includes("rtf")
    ) {
        return <FileText id="icon-doc" className="w-12 h-12 text-primary" />;
    }
    if (type.includes("image/"))
        return <ImageIcon id="icon-image" className="w-12 h-12 text-primary" />;
    if (type.includes("video/"))
        return <VideoIcon id="icon-video" className="w-12 h-12 text-primary" />;
    if (type.includes("audio/"))
        return <AudioIcon id="icon-audio" className="w-12 h-12 text-primary" />;
    if (
        type.includes("zip") ||
        type.includes("compressed") ||
        type.includes("tar") ||
        type.includes("rar") ||
        type.includes("7z")
    ) {
        return <ZipIcon id="icon-zip" className="w-12 h-12 text-primary" />;
    }
    if (
        type.includes("spreadsheet") ||
        type.includes("excel") ||
        type.includes("csv") ||
        type.includes("sheets")
    ) {
        return <SheetIcon id="icon-sheet" className="w-12 h-12 text-primary" />;
    }
    if (
        type.includes("json") ||
        type.includes("javascript") ||
        type.includes("typescript") ||
        type.includes("html") ||
        type.includes("css") ||
        type.includes("xml")
    ) {
        return <CodeIcon id="icon-code" className="w-12 h-12 text-primary" />;
    }
    return <FileIcon id="icon-generic" className="w-12 h-12 text-primary" />;
};

function Dropzone() {
    const inputId = useId();
    const inputRef = useRef<HTMLInputElement>(null);

    // States
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadedMeta, setUploadedMeta] = useState<any | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number>(0);

    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [deleteAfterDownload, setDeleteAfterDownload] = useState(false);

    // Clipboard and QR code states
    const [copied, setCopied] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

    // Deletion states
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Generate QR Code once file gets uploaded successfully
    useEffect(() => {
        if (uploadedMeta) {
            const fullShareLink = `${window.location.origin}/${uploadedMeta.id}`;
            QRCode.toDataURL(fullShareLink, {
                width: 300,
                margin: 2,
                color: {
                    dark: "#3E322D", // Matches the primary theme dark brown
                    light: "#FFFFFF",
                },
            })
                .then((url) => {
                    setQrCodeUrl(url);
                })
                .catch((err) => {
                    console.error("Gagal menghasilkan QR Code:", err);
                });
        } else {
            setQrCodeUrl("");
        }
    }, [uploadedMeta]);

    function handleFilesSelection(files: FileList | null) {
        if (!files || files.length === 0) return;
        const file = files[0];

        // Max size: 200MB limit explicitly
        if (file.size > 200 * 1024 * 1024) {
            setUploadError("Ukuran berkas melebihi batas maksimum 200 MB.");
            setSelectedFile(null);
            return;
        }

        setUploadError(null);
        setSelectedFile(file);
        setUploadedMeta(null);
        setUploadProgress(0);
    }

    const startUpload = () => {
        if (!selectedFile) return;

        setIsUploading(true);
        setUploadProgress(0);
        setUploadError(null);

        const xhr = new XMLHttpRequest();
        const url = `/api/upload?name=${encodeURIComponent(selectedFile.name)}&type=${encodeURIComponent(selectedFile.type)}&deleteAfterDownload=${deleteAfterDownload}`;

        xhr.open("POST", url, true);
        xhr.setRequestHeader("Content-Type", "application/octet-stream");

        // Track upload progress
        xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                setUploadProgress(percent);
            }
        });

        xhr.onload = () => {
            setIsUploading(false);
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const res = JSON.parse(xhr.responseText);
                    if (res.success) {
                        setUploadedMeta(res.metadata);
                    } else {
                        setUploadError(res.error || "Gagal mengunggah berkas.");
                    }
                } catch (err) {
                    setUploadError("Gagal memproses respons server.");
                }
            } else {
                try {
                    const res = JSON.parse(xhr.responseText);
                    setUploadError(res.error || "Gagal mengunggah berkas.");
                } catch (err) {
                    setUploadError(
                        `Terjadi kesalahan server (Kode status: ${xhr.status}).`,
                    );
                }
            }
        };

        xhr.onerror = () => {
            setIsUploading(false);
            setUploadError(
                "Sambungan terputus. Pastikan koneksi internet Anda stabil.",
            );
        };

        xhr.send(selectedFile);
    };

    const handleDeleteFile = async (id: string, redirectHome = true) => {
        setIsDeleting(true);
        setDeleteError(null);
        try {
            const res = await fetch(`/api/files/${id}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                throw new Error("Gagal menghapus berkas dari server.");
            }
            setShowDeleteConfirm(false);
            if (redirectHome) {
                resetUploadState();
            }
        } catch (err: any) {
            console.error(err);
            setDeleteError(
                err.message || "Terjadi kesalahan saat menghapus berkas.",
            );
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCopyBoth = async () => {
        if (!uploadedMeta || !qrCodeUrl) return;
        const fullShareLink = `${window.location.origin}/${uploadedMeta.id}`;

        try {
            const response = await fetch(qrCodeUrl);
            const blob = await response.blob();

            const data = [
                new ClipboardItem({
                    "text/plain": new Blob([fullShareLink], {
                        type: "text/plain",
                    }),
                    "image/png": blob,
                }),
            ];
            await navigator.clipboard.write(data);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error(
                "Gagal mencetak item rich clipboard, mencoba fallback teks biasa:",
                err,
            );
            navigator.clipboard
                .writeText(fullShareLink)
                .then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                })
                .catch(() => {
                    const text_area = document.createElement("textarea");
                    text_area.value = fullShareLink;
                    document.body.appendChild(text_area);
                    text_area.select();
                    document.execCommand("copy");
                    document.body.removeChild(text_area);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                });
        }
    };

    const resetUploadState = () => {
        setSelectedFile(null);
        setUploadProgress(0);
        setUploadError(null);
        setUploadedMeta(null);
        setDeleteAfterDownload(false);
        setShowDeleteConfirm(false);
        setDeleteError(null);
        if (inputRef.current) {
            inputRef.current.value = "";
        }
    };

    return (
        <div className="w-full">
            <AnimatePresence mode="wait">
                {!uploadedMeta ? (
                    <motion.div
                        key="upload-selector-step"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {/* Drag & Drop Area */}
                        <div
                            id="dropzone"
                            onDragOver={(e) => {
                                e.preventDefault();
                                setIsDragging(true);
                            }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDragging(false);
                                handleFilesSelection(e.dataTransfer.files);
                            }}
                            onClick={() => inputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
                                isDragging
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-primary/70 hover:bg-muted/50"
                            }`}
                        >
                            <input
                                id={inputId}
                                type="file"
                                className="hidden"
                                ref={inputRef}
                                onChange={(e) => handleFilesSelection(e.target.files)}
                            />

                            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4">
                                <Upload className="w-6 h-6 animate-pulse" />
                            </div>

                            <p className="text-sm font-medium text-foreground mb-1">
                                {isDragging
                                    ? "Lepaskan berkas sekarang..."
                                    : "Seret & letakkan berkas di sini"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                atau{" "}
                                <span className="text-primary underline font-medium">
                                    pilih berkas manual
                                </span>{" "}
                                dari komputer
                            </p>
                            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-muted-foreground rounded-md text-[11px] font-medium">
                                <HardDrive className="w-3.5 h-3.5 text-primary" />
                                Maks. ukuran berkas: 200 MB
                            </div>
                        </div>

                        {/* Error Alert */}
                        {uploadError && (
                            <motion.div
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                id="upload-error"
                                className="mt-4 flex items-start gap-2.5 p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs"
                            >
                                <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-semibold block mb-0.5">
                                        Kesalahan
                                    </span>
                                    {uploadError}
                                </div>
                            </motion.div>
                        )}

                        {/* Selected File Details & Upload Settings */}
                        {selectedFile && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                id="selected-file-details"
                                className="mt-5 border border-border bg-card text-card-foreground rounded-xl p-4 shadow-sm"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 bg-muted border border-border rounded-lg shrink-0">
                                        {getFileIcon(selectedFile.type)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p
                                            className="text-xs font-semibold text-foreground truncate"
                                            title={selectedFile.name}
                                        >
                                            {selectedFile.name}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            {formatSize(selectedFile.size)} •{" "}
                                            {selectedFile.type || "Berkas Mentah"}
                                        </p>
                                    </div>
                                </div>

                                {/* Self-destruct selection option */}
                                {!isUploading && (
                                    <div className="mb-4 pt-3 border-t border-border flex items-start gap-2.5 text-left">
                                        <input
                                            id="delete-on-download-checkbox"
                                            type="checkbox"
                                            checked={deleteAfterDownload}
                                            onChange={(e) =>
                                                setDeleteAfterDownload(e.target.checked)
                                            }
                                            className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-primary/30 accent-primary cursor-pointer shrink-0"
                                        />
                                        <label
                                            htmlFor="delete-on-download-checkbox"
                                            className="text-xs font-medium text-foreground select-none cursor-pointer"
                                        >
                                            Hapus otomatis setelah diunduh pertama kali
                                            <span className="block text-[10px] text-muted-foreground font-normal mt-0.5 leading-relaxed">
                                                Berkas akan langsung dihapus selamanya dari server setelah pertama kali diunduh oleh si penerima.
                                            </span>
                                        </label>
                                    </div>
                                )}

                                {/* Progress or Upload trigger */}
                                {isUploading ? (
                                    <div id="progress-container">
                                        <div className="flex justify-between text-[11px] font-semibold text-muted-foreground mb-1">
                                            <span>Mengunggah...</span>
                                            <span>{uploadProgress}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary transition-all duration-150 ease-out"
                                                style={{ width: `${uploadProgress}%` }}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        id="submit-upload-btn"
                                        onClick={startUpload}
                                        className="w-full mt-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                                    >
                                        <Upload className="w-4 h-4" />
                                        Unggah Berkas Baru
                                    </button>
                                )}
                            </motion.div>
                        )}
                    </motion.div>
                ) : (
                    /* Step 2: Upload Successfully Screen */
                    <motion.div
                        key="upload-success-step"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="text-center py-2"
                        id="step-succeeded"
                    >
                        <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto mb-3">
                            <CheckCircle className="w-6 h-6 animate-bounce" />
                        </div>

                        <h3 className="text-lg font-bold text-foreground mb-1">
                            Berkas Berhasil Diunggah!
                        </h3>
                        <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-4">
                            Bagikan tautan rahasia atau kode QR di bawah ini untuk segera diunduh penerima.
                        </p>

                        {/* File details card */}
                        <div className="bg-muted/50 border border-border rounded-xl p-3 text-left mb-4 flex items-center gap-3 max-w-sm mx-auto">
                            <div className="p-1.5 bg-card border border-border rounded-lg shrink-0">
                                {getFileIcon(uploadedMeta.type)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-foreground truncate">
                                    {uploadedMeta.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                    Ukuran: {formatSize(uploadedMeta.size)}
                                </p>
                            </div>
                        </div>

                        {/* QR Code Container */}
                        {qrCodeUrl ? (
                            <div id="qr-display-container" className="my-5 flex flex-col items-center">
                                <div className="bg-white border-2 border-border p-2.5 rounded-2xl inline-block shadow-sm">
                                    <img
                                        id="qr-code-image"
                                        src={qrCodeUrl}
                                        alt="QR Code Tautan Instan"
                                        className="w-32 h-32 select-none"
                                        referrerPolicy="no-referrer"
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1.5 font-medium">
                                    <QrIcon className="w-3.5 h-3.5 text-primary" />
                                    Pindai dengan kamera HP untuk mengunduh
                                </p>
                            </div>
                        ) : (
                            <div className="my-5 w-32 h-32 border border-dashed border-border rounded-2xl flex items-center justify-center text-xs text-muted-foreground mx-auto">
                                Memuat QR...
                            </div>
                        )}

                        {/* Link input & copy buttons */}
                        <div className="space-y-3.5 max-w-sm mx-auto">
                            <div>
                                <label className="block text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                                    Tautan Pengunduhan
                                </label>
                                <input
                                    id="copy-link-input"
                                    type="text"
                                    readOnly
                                    value={`${window.location.origin}/${uploadedMeta.id}`}
                                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground select-all focus:outline-none focus:border-primary"
                                />
                            </div>

                            <button
                                id="copy-both-btn"
                                onClick={handleCopyBoth}
                                className={`w-full py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-2 shadow-sm cursor-pointer ${
                                    copied
                                        ? "bg-emerald-600 hover:bg-emerald-650 text-white"
                                        : "bg-primary hover:bg-primary/90 text-primary-foreground"
                                }`}
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-4 h-4" />
                                        <span>Tautan & Kode QR Berhasil Disalin!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4" />
                                        <span>Salin Tautan & Kode QR</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Navigation controls / Delete box */}
                        <div className="mt-6 pt-5 border-t border-border space-y-4 max-w-sm mx-auto">
                            <button
                                id="reset-btn"
                                onClick={resetUploadState}
                                className="w-full bg-card hover:bg-muted text-foreground border border-border py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                Kirim Berkas Lainnya
                            </button>

                            {/* Control & Security Deletion panel */}
                            <div className="p-3.5 bg-destructive/5 border border-destructive/20 rounded-xl text-left w-full mx-auto">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                    <span className="text-xs font-bold text-destructive">
                                        Kendali Pengirim & Keamanan
                                    </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground leading-relaxed mb-3">
                                    Sebagai pengirim, Anda memiliki kontrol penuh atas berkas ini. Anda dapat menghapusnya saat ini juga tanpa perlu menunggu waktu kedaluwarsa atau unduhan pertama.
                                </p>

                                {showDeleteConfirm ? (
                                    <div className="space-y-2 bg-card/90 p-2.5 border border-destructive/20 rounded-lg">
                                        <p className="text-[10px] font-semibold text-destructive leading-normal">
                                            Apakah Anda yakin? Berkas akan langsung terhapus secara permanen dari server dan tidak dapat diakses lagi.
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleDeleteFile(uploadedMeta.id, true)}
                                                disabled={isDeleting}
                                                className="px-3 py-1.5 bg-destructive hover:bg-destructive/95 text-destructive-foreground text-[10px] font-bold rounded-lg shrink-0 transition-colors disabled:opacity-50 cursor-pointer"
                                            >
                                                {isDeleting ? "Menghapus..." : "Ya, Hapus Sekarang"}
                                            </button>
                                            <button
                                                onClick={() => setShowDeleteConfirm(false)}
                                                className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-muted-foreground text-[10px] font-semibold rounded-lg transition-colors cursor-pointer"
                                            >
                                                Batal
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="w-full bg-card hover:bg-destructive/5 text-destructive border border-destructive/20 py-2 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                                    >
                                        Hapus Berkas dari Server Selamanya
                                    </button>
                                )}

                                {deleteError && (
                                    <p className="text-[10px] text-destructive mt-2 font-medium">
                                        {deleteError}
                                    </p>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export { Dropzone };
export default Dropzone;
