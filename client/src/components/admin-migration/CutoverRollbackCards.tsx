import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function CutoverCard({
  enabled,
  isPending,
  onCutover,
}: {
  enabled: boolean;
  isPending: boolean;
  onCutover: (confirmText: string) => void;
}) {
  const { t } = useTranslation();
  const [confirm, setConfirm] = useState("");

  return (
    <Card className="border-rose-500/30">
      <CardHeader>
        <CardTitle>{t("admin.safeCutover", "Safe Cutover")}</CardTitle>
        <CardDescription>
          {t("admin.safeCutoverDesc", "Switch the app database connection after a successful migration.")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-xs text-muted-foreground">
          {t("admin.cutoverReq", "Requires: migration completed and ready for cutover.")}
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              className="w-full gap-2"
              disabled={!enabled || isPending}
              data-testid="button-cutover"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
              {t("admin.cutoverNow", "Cut Over Now")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("admin.confirmCutover", "Confirm cutover")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("admin.confirmCutoverDesc", "Type CUTOVER to switch the app DB connection.")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="confirm-cutover">Confirmation</Label>
              <Input
                id="confirm-cutover"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="CUTOVER"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={() => onCutover(confirm)} disabled={confirm !== "CUTOVER" || isPending}>
                {t("admin.cutover", "Cut Over")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

export function RollbackCard({
  isPending,
  onRollback,
}: {
  isPending: boolean;
  onRollback: (reason: string, confirmText: string) => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");

  return (
    <Card className="border-rose-500/30">
      <CardHeader>
        <CardTitle>{t("admin.rollback", "Rollback")}</CardTitle>
        <CardDescription>
          {t("admin.rollbackDesc", "Revert to the previous connection if cutover causes issues.")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="rollback-reason">{t("admin.rollbackReason", "Reason")}</Label>
          <Input
            id="rollback-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("admin.rollbackReasonPh", "Briefly describe why")}
          />
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full gap-2 border-rose-500/40 text-rose-200 hover:bg-rose-500/10"
              disabled={isPending || reason.trim().length === 0}
              data-testid="button-rollback"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {t("admin.rollbackNow", "Rollback to Previous DB")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("admin.confirmRollback", "Confirm rollback")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("admin.confirmRollbackDesc", "Type ROLLBACK to revert the DB connection.")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="confirm-rollback">Confirmation</Label>
              <Input
                id="confirm-rollback"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="ROLLBACK"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onRollback(reason, confirm);
                  setConfirm("");
                  setReason("");
                }}
                disabled={confirm !== "ROLLBACK" || isPending}
              >
                {t("admin.rollback", "Rollback")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <div className="text-xs text-muted-foreground">
          {t("admin.rollbackNote", "Rollback requires a prior successful cutover within this runtime.")}
        </div>
      </CardContent>
    </Card>
  );
}

