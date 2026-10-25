import type { PublicBusinessReview } from "@/lib/data/reputationService";

function reviewDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { month: "short", year: "numeric", timeZone: "America/Lima" }).format(new Date(value));
}

export function PublicReviewsSection({
  reviews,
  ratingAverage,
  reviewCount,
  loadFailed = false,
}: {
  reviews: PublicBusinessReview[];
  ratingAverage: number | null;
  reviewCount: number;
  loadFailed?: boolean;
}) {
  return (
    <section className="platform-reviews" aria-labelledby="platform-reviews-title">
      <div className="platform-reviews__heading">
        <div><span className="eyebrow">RESEÑAS VERIFICADAS</span><h2 id="platform-reviews-title">Experiencias después de jugar</h2></div>
        {reviewCount > 0 && ratingAverage !== null ? (
          <div className="platform-reputation" aria-label={`${ratingAverage.toFixed(1)} de 5, ${reviewCount} reseñas verificadas`}>
            <strong>{ratingAverage.toFixed(1)}</strong><span aria-hidden="true">★</span><small>{reviewCount} {reviewCount === 1 ? "reseña" : "reseñas"}</small>
          </div>
        ) : <span className="platform-reviews__empty-label">Aún sin reseñas</span>}
      </div>
      {loadFailed ? (
        <p className="platform-reviews__empty platform-reviews__empty--error" role="status">La reputación agregada sigue disponible, pero no pudimos cargar el detalle de las valoraciones en este momento.</p>
      ) : reviews.length ? (
        <div className="platform-review-grid">
          {reviews.map((review) => (
            <article className="platform-review-card" key={review.review_id}>
              <div className="platform-review-card__top"><span aria-label={`${review.rating} de 5 estrellas`}><b aria-hidden="true">{"★".repeat(review.rating)}</b></span><small>Reserva verificada</small></div>
              <p className="platform-review-card__muted">Valoración verificada después de una reserva completada.</p>
              <footer><span>{review.sport_name} · {review.court_name}</span><time dateTime={review.created_at}>{reviewDate(review.created_at)}</time></footer>
            </article>
          ))}
        </div>
      ) : <p className="platform-reviews__empty">Las reseñas aparecerán aquí únicamente después de una reserva completada y vinculada a una cuenta.</p>}
    </section>
  );
}
