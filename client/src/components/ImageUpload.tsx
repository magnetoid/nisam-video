import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Upload, X, Image as ImageIcon, Loader2, Link as LinkIcon } from "lucide-react";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  accept?: string;
  maxSizeMB?: number;
  placeholder?: string;
  previewHeight?: string;
}

export function ImageUpload({
  value,
  onChange,
  folder = "seo",
  accept = "image/png,image/jpeg,image/webp,image/gif",
  maxSizeMB = 5,
  placeholder,
  previewHeight = "h-40",
}: ImageUploadProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSizeMB * 1024 * 1024) {
      toast({
        title: t("common.error", "Error"),
        description: t("upload.fileTooLarge", `File must be under ${maxSizeMB}MB`),
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const res = await fetch(`/api/uploads/blob?folder=${encodeURIComponent(folder)}`, {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "x-filename": file.name,
        },
        credentials: "include",
        body: file,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      onChange(data.url);

      toast({
        title: t("common.success", "Success"),
        description: t("upload.success", "Image uploaded successfully"),
      });
    } catch (err: any) {
      toast({
        title: t("common.error", "Error"),
        description: err.message || t("upload.failed", "Failed to upload image"),
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUrlSubmit = () => {
    const trimmed = urlInput.trim();
    if (trimmed) {
      onChange(trimmed);
      setUrlInput("");
      setShowUrlInput(false);
    }
  };

  const handleRemove = () => {
    onChange("");
  };

  return (
    <div className="space-y-3">
      {/* Preview */}
      {value ? (
        <div className={`relative ${previewHeight} rounded-lg overflow-hidden border border-border bg-muted group`}>
          <img
            src={value}
            alt="Preview"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "";
              (e.target as HTMLImageElement).alt = "Failed to load";
            }}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleRemove}
            >
              <X className="h-4 w-4 mr-1" />
              {t("common.remove", "Remove")}
            </Button>
          </div>
          <div className="absolute bottom-2 left-2 right-2">
            <p className="text-xs text-white/80 bg-black/60 px-2 py-1 rounded truncate">{value}</p>
          </div>
        </div>
      ) : (
        <div
          className={`${previewHeight} rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors bg-muted/30 flex flex-col items-center justify-center cursor-pointer`}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? (
            <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
          ) : (
            <>
              <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {placeholder || t("upload.clickToUpload", "Click to upload an image")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG, WebP ({maxSizeMB}MB max)
              </p>
            </>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-1" />
          )}
          {t("upload.uploadFile", "Upload File")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowUrlInput(!showUrlInput)}
        >
          <LinkIcon className="h-4 w-4 mr-1" />
          {t("upload.pasteUrl", "Paste URL")}
        </Button>
      </div>

      {/* URL input */}
      {showUrlInput && (
        <div className="flex gap-2">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/image.png"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleUrlSubmit())}
          />
          <Button type="button" size="sm" onClick={handleUrlSubmit} disabled={!urlInput.trim()}>
            {t("common.apply", "Apply")}
          </Button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
