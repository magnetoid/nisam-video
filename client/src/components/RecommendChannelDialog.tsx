import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";

export function RecommendChannelDialog({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/channel-recommendations", {
        url,
        description,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t("recommend.thanksTitle", "Thanks!"),
        description: t("recommend.thanksDesc", "Your YouTube channel recommendation was submitted for review."),
      });
      setUrl("");
      setDescription("");
      setOpen(false);
    },
    onError: (err: any) => {
      toast({
        title: t("recommend.errorTitle", "Could not submit"),
        description:
          err?.message ||
          t("recommend.errorDesc", "Please check the channel URL (YouTube channels only) and try again."),
        variant: "destructive",
      });
    },
  });

  const disabled = !url.trim() || submitMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("recommend.title", "Recommend a YouTube channel")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recommend-channel-url">{t("recommend.channelUrl", "Channel URL")}</Label>
            <Input
              id="recommend-channel-url"
              placeholder={t("recommend.placeholderUrl", "https://www.youtube.com/@channel")}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              data-testid="input-recommend-channel-url"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recommend-channel-description">{t("recommend.description", "Description (optional)")}</Label>
            <Textarea
              id="recommend-channel-description"
              placeholder={t("recommend.placeholderDesc", "What kind of content does this channel publish?")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              data-testid="input-recommend-channel-description"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              data-testid="button-recommend-channel-cancel"
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => submitMutation.mutate()}
              disabled={disabled}
              data-testid="button-recommend-channel-submit"
            >
              {submitMutation.isPending ? t("common.submitting", "Submitting...") : t("common.submit", "Submit")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

