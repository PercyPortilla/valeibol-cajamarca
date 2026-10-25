"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";
import type { ReviewModerationStatus } from "@/lib/data/supabase/database.types";

type ExistingReview = {
  reviewId: string;
  rating: number;
  comment: string | null;
  status: ReviewModerationStatus;
};

const STATUS_LABEL: Record<ReviewModerationStatus, string> = {
  pending: "Pendiente de moderación",
  published: "Publicada",
  rejected: "No publicada",
  hidden: "Oculta por moderación",
};

export function VerifiedReviewForm({
  reservationId,
  existing,
}: {
  reservationId: string;
  existing: ExistingReview | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (existing) {
    return (
      <div className="account-review-existing">
        <div><strong aria-label={`${existing.rating} de 5 estrellas`}><span aria-hidden="true">{"★".repeat(existing.rating)}</span></strong><span>{STATUS_LABEL[existing.status]}</span></div>
        <p>{existing.comment || "Valoración enviada sin comentario."}</p>
        <small>Una reseña moderada no se edita desde el cliente; así se conserva el historial de revisión.</small>
      </div>
    );
  }

  function submit() {
    setMessage(null);
    startTransition(async () => {
      try {
        const client = createPublicBrowserSupabaseClient();
        const { error } = await client.rpc("submit_verified_business_review", {
          p_reservation_id: reservationId,
          p_rating: rating,
          p_comment: comment.trim() || null,
        });
        if (error) throw error;
        setMessage("Reseña enviada. Se publicará cuando la moderación global la apruebe.");
        router.refresh();
      } catch {
        setMessage("No pudimos enviar la reseña. Verifica tu sesión e inténtalo nuevamente.");
      }
    });
  }

  return (
    <div className="account-review-form">
      <fieldset disabled={isPending}>
        <legend>Calificación</legend>
        <div className="account-review-rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value}>
              <input type="radio" name={`rating-${reservationId}`} value={value} checked={rating === value} onChange={() => setRating(value)} />
              <span aria-hidden="true">★</span><b>{value}</b>
            </label>
          ))}
        </div>
        <label className="account-review-comment">
          <span>Comentario <small>opcional</small></span>
          <textarea maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Cuenta cómo fue tu experiencia sin compartir datos personales." />
          <small>{comment.length}/1000</small>
        </label>
        <button className="button button--primary" type="button" onClick={submit}>{isPending ? "Enviando…" : "Enviar reseña"}</button>
      </fieldset>
      {message ? <p className="account-review-feedback" role="status" aria-live="polite">{message}</p> : null}
    </div>
  );
}
