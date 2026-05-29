import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const UPLOADS_DIR = path.resolve("uploads");

// Ensure upload directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const EXPIRATION_TIME = 1 * 60 * 60 * 1000; // 1 hour in milliseconds

// Helper to check and cleanup an expired file
const checkAndCleanFile = (id: string): boolean => {
    const filePath = path.join(UPLOADS_DIR, id);
    const metaPath = path.join(UPLOADS_DIR, `${id}.json`);

    if (!fs.existsSync(metaPath)) {
        return false;
    }

    try {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
        // Safety net: files that weren't downloaded get cleaned up after 1 hour
        const elapsed = Date.now() - meta.uploadedAt;
        if (elapsed > EXPIRATION_TIME) {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            if (fs.existsSync(metaPath)) {
                fs.unlinkSync(metaPath);
            }
            console.log(
                `[Auto-Clean] Successfully purged expired file ${id} (elapsed: ${Math.round(
                    elapsed / 60000
                )} minutes)`
            );
            return true; // Was expired and cleaned up
        }
    } catch (err) {
        console.error(`Error checking/cleaning file ${id}:`, err);
    }
    return false;
};

// Periodic background cleanup running every 5 minutes
export const startPeriodicCleanup = () => {
    setInterval(
        () => {
            try {
                if (!fs.existsSync(UPLOADS_DIR)) return;
                const items = fs.readdirSync(UPLOADS_DIR);
                const jsonFiles = items.filter((f) => f.endsWith(".json"));
                let cleanedCount = 0;

                for (const jsonFile of jsonFiles) {
                    const id = jsonFile.replace(".json", "");
                    const didClean = checkAndCleanFile(id);
                    if (didClean) {
                        cleanedCount++;
                    }
                }

                if (cleanedCount > 0) {
                    console.log(
                        `[Scheduled Cleanup] Purged ${cleanedCount} expired files from uploads directory.`
                    );
                }
            } catch (err) {
                console.error(
                    "[Scheduled Cleanup] Error occurred during periodic check:",
                    err
                );
            }
        },
        5 * 60 * 1000
    ); // 5 minutes interval
};

const router = express.Router();

// Upload Endpoint
router.post(
    "/upload",
    express.raw({ type: "*/*", limit: "200mb" }),
    async (req, res) => {
        try {
            const fileName = (req.query.name as string) || "unnamed_file";
            const fileType =
                (req.query.type as string) || "application/octet-stream";
            const body = req.body;

            if (!body || body.length === 0) {
                res.status(400).json({
                    error: "File data is empty or invalid.",
                });
                return;
            }

            // Generate a secure short code (6 bytes -> 12 hex characters)
            const fileId = crypto.randomBytes(6).toString("hex");
            const filePath = path.join(UPLOADS_DIR, fileId);
            const metaPath = path.join(UPLOADS_DIR, `${fileId}.json`);

            // Write file binary
            fs.writeFileSync(filePath, body);

            // Save metadata
            const metadata = {
                id: fileId,
                name: fileName,
                type: fileType,
                size: body.length,
                uploadedAt: Date.now(),
                downloadsCount: 0,
                deleteAfterDownload: true,
            };

            fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));

            res.json({
                success: true,
                fileId,
                metadata,
            });
        } catch (err: any) {
            console.error("Error during upload:", err);
            res.status(500).json({
                error: "Failed to upload file: " + err.message,
            });
        }
    }
);

// File Metadata Endpoint
router.get("/files/:id/meta", async (req, res) => {
    try {
        const { id } = req.params;

        // Check expiration and clean if expired
        const isCleaned = checkAndCleanFile(id);
        if (isCleaned) {
            res.status(404).json({
                error: "This file has expired after the 1-hour time limit.",
            });
            return;
        }

        const metaPath = path.join(UPLOADS_DIR, `${id}.json`);

        if (!fs.existsSync(metaPath)) {
            res.status(404).json({
                error: "File not found or the link has expired.",
            });
            return;
        }

        const metaFileContent = fs.readFileSync(metaPath, "utf8");
        const meta = JSON.parse(metaFileContent);

        // Calculate dynamic remaining time in ms
        let timeRemaining: number | null = null;
        if (!meta.deleteAfterDownload) {
            const elapsed = Date.now() - meta.uploadedAt;
            timeRemaining = Math.max(0, EXPIRATION_TIME - elapsed);
        }

        res.json({
            ...meta,
            timeRemaining,
        });
    } catch (err: any) {
        console.error("Error fetching file meta:", err);
        res.status(500).json({ error: "Failed to load file information." });
    }
});

// Manual Delete Endpoint
router.delete("/files/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const filePath = path.join(UPLOADS_DIR, id);
        const metaPath = path.join(UPLOADS_DIR, `${id}.json`);

        let deleted = false;
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deleted = true;
        }
        if (fs.existsSync(metaPath)) {
            fs.unlinkSync(metaPath);
            deleted = true;
        }

        if (deleted) {
            res.json({
                success: true,
                message: "File has been permanently deleted.",
            });
        } else {
            res.status(404).json({
                error: "File not found or already deleted.",
            });
        }
    } catch (err: any) {
        console.error("Error manual deletion:", err);
        res.status(500).json({
            error: "Failed to delete file: " + err.message,
        });
    }
});

// Download Endpoint
router.get("/files/:id/download", async (req, res) => {
    try {
        const { id } = req.params;

        // Check expiration and clean if expired
        const isCleaned = checkAndCleanFile(id);
        if (isCleaned) {
            res.status(410).send(
                "Sorry, this file has expired after the 1-hour time limit."
            );
            return;
        }

        const filePath = path.join(UPLOADS_DIR, id);
        const metaPath = path.join(UPLOADS_DIR, `${id}.json`);

        if (!fs.existsSync(filePath) || !fs.existsSync(metaPath)) {
            res.status(404).send(
                "Sorry, this file was not found or the link has expired."
            );
            return;
        }

        const metaJSON = fs.readFileSync(metaPath, "utf8");
        const meta = JSON.parse(metaJSON);

        // Increment downloads count safely
        meta.downloadsCount = (meta.downloadsCount || 0) + 1;
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

        // Headers for standard attachment download
        const safeName = encodeURIComponent(meta.name);
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${safeName}"; filename*=UTF-8''${safeName}`
        );
        res.setHeader("Content-Type", meta.type || "application/octet-stream");
        res.setHeader("Content-Length", meta.size);

        // Self-destruct listener on finish response
        if (meta.deleteAfterDownload) {
            res.on("finish", () => {
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                    if (fs.existsSync(metaPath)) {
                        fs.unlinkSync(metaPath);
                    }
                    console.log(
                        `[Self-Destruct] File and metadata for ${id} unlinked successfully after first download.`
                    );
                } catch (unlinkErr) {
                    console.error(
                        "[Self-Destruct] Failed to unlink file:",
                        unlinkErr
                    );
                }
            });
        }

        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
    } catch (err: any) {
        console.error("Error streaming file download:", err);
        res.status(500).send("An error occurred while downloading the file.");
    }
});

export default router;
