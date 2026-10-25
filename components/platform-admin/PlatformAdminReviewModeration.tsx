"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";
import type { Database, ReviewModerationStatus } from "@/lib/data/supabase/database.types";

export type PlatformAdminReview = Database["public"]["Functions"]["get_platform_admin_reviews_page"]["Returns"][number];

const STATUS_LABELS: Record<ReviewModerationStatus, string> = {
  pending: "Pendientes",
  published: "Publicadas",
  rejected: "Rechazadas",
  hidden: "Ocultas",
};

const STATUSES: ReviewModerationStatus[] = ["pending", "published", "rejected", "hidden"];

function reviewHref(status: ReviewModerationStatus, reviewPage: number, businessPage: number) {
  const params = new URLSearchParams();
  if (businessPage > 1) params.set("page", String(businessPage));
  params.set("reviewStatus", status);
  if (reviewPage > 1) params.set("reviewPage", String(reviewPage));
  return `/admin-global?${params.toString()}`;
}

export function PlatformAdminReviewModeration({
  reviews,
  status,
  currentPage,
  hasNext,
  loadFailed,
  businessPage,
}: {
  reviews: PlatformAdminReview[];
  status: ReviewModerationStatus;
  currentPage: number;
  hasNext: boolean;
  loadFailed: boolean;
  businessPage: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function moderate(reviewId: string, nextStatus: Exclude<ReviewModerationStatus, "pending">) {
    setBusy(reviewId);
    setError(null);
    try {
      const client = createPublicBrowserSupabaseClient();
      const { error: rpcError } = await client.rpc("platform_admin_moderate_review", {
        p_review_id: reviewId,
        p_status: nextStatus,
      });
      if (rpcError) throw rpcError;
      router.refresh();
    } catch {
      setError("No se pudo actualizar la moderación de la reseña.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="global-admin-reviews" aria-labelledby="global-admin-reviews-title">
      <div className="global-admin-section-heading">
        <div>
          <span className="eyebrow">REPUTACIÓN</span>
          <h2 id="global-admin-reviews-title">Moderación de reseñas verificadas</h2>
          <p>Solo las reseñas publicadas cuentan para el promedio público. El negocio no puede moderar su propia reputación. Antes de publicar, revisa que el comentario no incluya teléfono, correo u otros datos personales.</p>
        </div>
      </div>

      <nav className="global-admin-review-tabs" aria-label="Filtrar reseñas por estado">
        {STATUSES.map((item) => (
          <Link key={item} href={reviewHref(item, 1, businessPage)} aria-current={status === item ? "page" : undefined}>
            {STATUS_LABELS[item]}
          </Link>
        ))}
      </nav>

      <section className="global-admin-review-group">
        <div className="global-admin-review-group__heading">
          <h3>{STATUS_LABELS[status]}</h3>
          <span>{reviews.length} en esta página</span>
        </div>

        {loadFailed ? (
          <p className="global-admin-review-error" role="alert">No pudimos cargar esta lista de reseñas. Vuelve a intentarlo sin asumir que está vacía.</p>
        ) : reviews.length ? (
          <div className="global-admin-review-list">
            {reviews.map((review) => (
              <article key={review.review_id} className="global-admin-review-card">
                <div className="global-admin-review-card__top">
                  <strong>{review.business_name}</strong>
                  <span aria-label={`${review.rating} de 5 estrellas`}><b aria-hidden="true">{"★".repeat(review.rating)}</b></span>
                </div>
                <p>{review.comment || "Valoración sin comentario."}</p>
                <small>{review.sport_name} · {review.court_name}</small>
                <div className="global-admin-review-actions">
                  {review.review_status !== "published" ? <button type="button" disabled={busy === review.review_id} onClick={() => moderate(review.review_id, "published")}>Publicar</button> : null}
                  {review.review_status === "published" ? <button type="button" disabled={busy === review.review_id} onClick={() => moderate(review.review_id, "hidden")}>Ocultar</button> : null}
                  {review.review_status === "pending" ? <button type="button" disabled={busy === review.review_id} onClick={() => moderate(review.review_id, "rejected")}>Rechazar</button> : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="global-admin-review-empty">No hay reseñas en este estado para esta página.</p>
        )}

        {!loadFailed ? (
          <nav className="global-admin-review-pagination" aria-label="Paginación de reseñas">
            {currentPage > 1 ? <Link href={reviewHref(status, currentPage - 1, businessPage)}>← Anterior</Link> : <span />}
            <span>Página {currentPage}</span>
            {hasNext ? <Link href={reviewHref(status, currentPage + 1, businessPage)}>Siguiente →</Link> : <span />}
          </nav>
        ) : null}
      </section>

      {error ? <p className="global-admin-review-error" role="alert">{error}</p> : null}
    </section>
  );
}
