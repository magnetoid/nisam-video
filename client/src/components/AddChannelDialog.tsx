import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";

interface AddChannelDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd?: (url: string, name: string) => void;
}

export function AddChannelDialog({
  open,
  onClose,
  onAdd,
}: AddChannelDialogProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim() && name.trim()) {
      onAdd?.(url.trim(), name.trim());
      setUrl("");
      setName("");
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent data-testid="modal-add-channel">
        <DialogHeader>
          <DialogTitle>{t("channels.addChannel", "Add YouTube Channel")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel-name">{t("channels.channelName", "Channel Name")}</Label>
            <Input
              id="channel-name"
              type="text"
              placeholder={t("channels.enterChannelName", "Enter channel name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-channel-name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel-url">{t("channels.channelUrl", "Channel URL")}</Label>
            <Input
              id="channel-url"
              type="url"
              placeholder="https://www.youtube.com/@channelname"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              data-testid="input-channel-url"
              required
            />
            <p className="text-xs text-muted-foreground">
              {t("channels.enterFullUrl", "Enter the full YouTube channel URL")}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-testid="button-cancel"
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!url.trim() || !name.trim()}
              data-testid="button-submit"
            >
              {t("common.add", "Add Channel")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
