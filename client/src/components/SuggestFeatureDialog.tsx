import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";

export function SuggestFeatureDialog({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("feature");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/suggestions", {
        type,
        subject,
        message,
        email: email || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t("suggest.thanksTitle", "Thank you!"),
        description: t("suggest.thanksDesc", "Your suggestion has been submitted. We review every submission and work to make this platform better."),
      });
      setSubject("");
      setMessage("");
      setEmail("");
      setType("feature");
      setOpen(false);
    },
    onError: (err: any) => {
      toast({
        title: t("suggest.errorTitle", "Could not submit"),
        description: err?.message || t("suggest.errorDesc", "Please try again later."),
        variant: "destructive",
      });
    },
  });

  const disabled = !subject.trim() || !message.trim() || submitMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t("suggest.title", "Suggest a Feature or Contact Us")}</DialogTitle>
          <DialogDescription>
            {t("suggest.description", "Have an idea, feedback, or question? We read every message and work to implement your suggestions.")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("suggest.type", "Type")}</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="feature">{t("suggest.typeFeature", "Feature Suggestion")}</SelectItem>
                <SelectItem value="bug">{t("suggest.typeBug", "Bug Report")}</SelectItem>
                <SelectItem value="channel">{t("suggest.typeChannel", "Channel Recommendation")}</SelectItem>
                <SelectItem value="contact">{t("suggest.typeContact", "General Contact")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="suggest-subject">{t("suggest.subject", "Subject")}</Label>
            <Input
              id="suggest-subject"
              placeholder={t("suggest.subjectPlaceholder", "Brief summary of your suggestion...")}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="suggest-message">{t("suggest.message", "Message")}</Label>
            <Textarea
              id="suggest-message"
              placeholder={t("suggest.messagePlaceholder", "Describe your idea, feedback, or question in detail...")}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={2000}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="suggest-email">{t("suggest.email", "Email (optional)")}</Label>
            <Input
              id="suggest-email"
              type="email"
              placeholder={t("suggest.emailPlaceholder", "your@email.com — if you'd like us to respond")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => submitMutation.mutate()}
              disabled={disabled}
            >
              {submitMutation.isPending ? t("common.submitting", "Submitting...") : t("common.submit", "Submit")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
