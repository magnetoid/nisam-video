import { useState, useEffect, useContext, createContext } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface LikeStatus {
  isLiked: boolean;
  likesCount: number;
}

interface LikeStatusContextType {
  statuses: Record<string, LikeStatus>;
  isLoading: boolean;
}

export const LikeStatusContext = createContext<LikeStatusContextType | null>(null);

interface LikeButtonProps {
  videoId: string;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
  showCount?: boolean;
}

export function LikeButton({
  videoId,
  variant = "ghost",
  size = "default",
  showCount = true,
}: LikeButtonProps) {
  const { toast } = useToast();
  const [localIsLiked, setLocalIsLiked] = useState<boolean | null>(null);
  const batchContext = useContext(LikeStatusContext);

  const { data: likeStatus, isLoading: individualLoading } = useQuery({
    queryKey: ["/api/videos", videoId, "like-status"],
    queryFn: async () => {
      const res = await fetch(`/api/videos/${videoId}/like-status`);
      if (!res.ok) throw new Error("Failed to fetch like status");
      return res.json() as Promise<LikeStatus>;
    },
    enabled: !batchContext,
  });

  const batchStatus = batchContext?.statuses?.[videoId];
  const effectiveLikeStatus = batchContext ? batchStatus : likeStatus;
  const isLoading = batchContext ? batchContext.isLoading : individualLoading;

  // Sync local state with server state
  useEffect(() => {
    if (effectiveLikeStatus && localIsLiked === null) {
      setLocalIsLiked(effectiveLikeStatus.isLiked);
    }
  }, [effectiveLikeStatus, localIsLiked]);

  const likeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/videos/${videoId}/like`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to like video");
      }
      return res.json();
    },
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["/api/videos", videoId, "like-status"],
      });

      // Snapshot the previous value
      const previousStatus = queryClient.getQueryData([
        "/api/videos",
        videoId,
        "like-status",
      ]);

      // Optimistically update
      queryClient.setQueryData(
        ["/api/videos", videoId, "like-status"],
        (old: any) => ({
          isLiked: true,
          likesCount: (old?.likesCount || 0) + 1,
        }),
      );

      return { previousStatus };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousStatus) {
        queryClient.setQueryData(
          ["/api/videos", videoId, "like-status"],
          context.previousStatus,
        );
        // Reset local state to match server
        setLocalIsLiked((context.previousStatus as any).isLiked);
      }
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/videos", videoId, "like-status"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/videos/batch/like-status" 
      });
    },
  });

  const unlikeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/videos/${videoId}/like`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to unlike video");
      }
      return res.json();
    },
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["/api/videos", videoId, "like-status"],
      });

      // Snapshot the previous value
      const previousStatus = queryClient.getQueryData([
        "/api/videos",
        videoId,
        "like-status",
      ]);

      // Optimistically update
      queryClient.setQueryData(
        ["/api/videos", videoId, "like-status"],
        (old: any) => ({
          isLiked: false,
          likesCount: Math.max((old?.likesCount || 0) - 1, 0),
        }),
      );

      return { previousStatus };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousStatus) {
        queryClient.setQueryData(
          ["/api/videos", videoId, "like-status"],
          context.previousStatus,
        );
        // Reset local state to match server
        setLocalIsLiked((context.previousStatus as any).isLiked);
      }
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/videos", videoId, "like-status"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/videos/batch/like-status" 
      });
    },
  });

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Prevent clicks while mutations are in progress
    if (isPending) {
      return;
    }

    // Use local state to determine action (more reliable than query cache)
    const currentlyLiked = localIsLiked ?? effectiveLikeStatus?.isLiked ?? false;

    if (currentlyLiked) {
      console.log(
        `[LikeButton] Unliking video ${videoId}, current state:`,
        currentlyLiked,
      );
      setLocalIsLiked(false); // Optimistically update local state
      unlikeMutation.mutate();
    } else {
      console.log(
        `[LikeButton] Liking video ${videoId}, current state:`,
        currentlyLiked,
      );
      setLocalIsLiked(true); // Optimistically update local state
      likeMutation.mutate();
    }
  };

  const isLiked = localIsLiked ?? effectiveLikeStatus?.isLiked ?? false;
  const likesCount = effectiveLikeStatus?.likesCount || 0;
  const isPending = likeMutation.isPending || unlikeMutation.isPending;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={isLoading || isPending}
      className="gap-2"
      data-testid={`button-like-${videoId}`}
    >
      <Heart
        className={`transition-all ${isLiked ? "fill-red-500 text-red-500" : ""}`}
        size={size === "sm" ? 16 : size === "lg" ? 24 : 20}
      />
      {showCount && (
        <span data-testid={`text-likes-count-${videoId}`}>{likesCount}</span>
      )}
    </Button>
  );
}

interface LikeStatusBatchProviderProps {
  videoIds: string[];
  children: React.ReactNode;
}

export function LikeStatusBatchProvider({ videoIds, children }: LikeStatusBatchProviderProps) {
  const { data: statuses, isLoading } = useQuery({
    queryKey: ["/api/videos/batch/like-status", videoIds.sort().join(",")],
    queryFn: async () => {
      if (videoIds.length === 0) return {};
      
      const res = await fetch("/api/videos/batch/like-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoIds }),
      });
      
      if (!res.ok) throw new Error("Failed to fetch batch like status");
      return res.json() as Promise<Record<string, LikeStatus>>;
    },
    enabled: videoIds.length > 0,
    staleTime: 30000,
  });

  return (
    <LikeStatusContext.Provider value={{ statuses: statuses || {}, isLoading }}>
      {children}
    </LikeStatusContext.Provider>
  );
}
