import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { PlatformBusinessDetail } from "../lib/data/repositories/platformRepository.ts";
import { buildBusinessJsonLd } from "../lib/platform/seo.ts";

const migration = readFileSync("supabase/migrations/20261024012000_block18_favorites_reviews.sql", "utf8");
const businessCard = readFileSync("components/platform/BusinessCard.tsx", "utf8");
const favoriteButton = readFileSync("components/platform/FavoriteButton.tsx", "utf8");
const accountPage = readFileSync("app/mi-cuenta/page.tsx", "utf8");
const reviewForm = readFileSync("components/account/VerifiedReviewForm.tsx", "utf8");
const globalAdmin = readFileSync("app/admin-global/page.tsx", "utf8");
const globalModeration = readFileSync("components/platform-admin/PlatformAdminReviewModeration.tsx", "utf8");
const adminActions = readFileSync("components/admin/AdminReservationActions.tsx", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");

test("B18 favoritos y reseñas usan tablas aditivas con RLS y sin DML público", () => {
  assert.match(migration, /create table if not exists public\.business_favorites/i);
  assert.match(migration, /create table if not exists public\.business_reviews/i);
  assert.match(migration, /alter table public\.business_favorites enable row level security/i);
  assert.match(migration, /alter table public\.business_reviews enable row level security/i);
  assert.match(migration, /revoke all on public\.business_favorites, public\.business_reviews from public, anon, authenticated/i);
  assert.match(migration, /primary key \(user_id, business_id\)/i);
  assert.match(migration, /reservation_id uuid not null unique references public\.reservations\(id\) on delete cascade/i);
});

test("reseña verificada deriva identidad y exige reserva completed propia", () => {
  const submit = migration.match(/create or replace function public\.submit_verified_business_review[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(submit, /v_user_id uuid := auth\.uid\(\)/i);
  assert.match(submit, /r\.user_id = v_user_id/i);
  assert.match(submit, /r\.status = 'completed'/i);
  assert.doesNotMatch(submit, /p_user_id|p_business_id/i);
  assert.match(submit, /review_already_exists/i);
});

test("solo reseñas published alimentan reputación pública y no se exponen identidades", () => {
  const publicReviews = migration.match(/create or replace function public\.get_public_business_reviews[\s\S]*?\$\$;/i)?.[0] ?? "";
  const catalog = migration.match(/create function public\.get_public_platform_catalog[\s\S]*?\$\$;/i)?.[0] ?? "";
  const publicReturns = publicReviews.match(/returns table \([\s\S]*?\)\s*language sql/i)?.[0] ?? "";
  assert.match(publicReviews, /rv\.status = 'published'/i);
  assert.doesNotMatch(publicReviews, /rv\.comment|user_id|customer_id|phone|email/i);
  assert.doesNotMatch(publicReturns, /reservation_id|business_id|user_id|customer_id|comment|phone|email/i);
  assert.match(catalog, /where rv\.status = 'published'/i);
  assert.match(catalog, /round\(avg\(rv\.rating\)::numeric, 1\)/i);
  assert.doesNotMatch(catalog, /favorite_count/i);
});

test("moderación pertenece al ADMIN global y no al tenant", () => {
  const list = migration.match(/create or replace function public\.get_platform_admin_reviews_page[\s\S]*?\$\$;/i)?.[0] ?? "";
  const moderate = migration.match(/create or replace function public\.platform_admin_moderate_review[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(list, /public\.is_platform_admin\(\)/i);
  assert.match(moderate, /not public\.is_platform_admin\(\)/i);
  assert.doesNotMatch(moderate, /can_manage_business|phase6_admin_actor/i);
  assert.match(globalAdmin, /PlatformAdminReviewModeration/);
});

test("confirmed solo puede completarse después de end_at y habilita reseña", () => {
  const complete = migration.match(/create or replace function public\.admin_complete_reservation[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(complete, /v_reservation\.status <> 'confirmed'/i);
  assert.match(complete, /v_reservation\.end_at > now\(\)/i);
  assert.match(complete, /set status = 'completed'/i);
  assert.match(adminActions, /completeReservationAction/);
  assert.match(adminActions, /Marcar completada/);
});

test("favorito es una isla cliente accesible y no queda dentro de aria-hidden", () => {
  assert.match(businessCard, /<FavoriteButton businessId=\{business\.businessId\}/);
  assert.ok(businessCard.indexOf("<FavoriteButton") < businessCard.indexOf("aria-hidden"));
  assert.match(favoriteButton, /aria-pressed=\{signedIn \? favorite : undefined\}/);
  assert.match(favoriteButton, /router\.push\("\/mi-cuenta"\)/);
  assert.match(favoriteButton, /setError\("No pudimos cargar tus favoritos\."\)/);
  assert.match(favoriteButton, /setError\("No pudimos actualizar este favorito\. Inténtalo otra vez\."\)/);
  assert.match(favoriteButton, /pathname === "\/mi-cuenta"\) router\.refresh\(\)/);
  assert.match(css, /\.platform-favorite-button\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px/i);
});

test("Mi cuenta carga favoritos y reseñas elegibles sin query por reserva", () => {
  assert.match(accountPage, /Promise\.all\(\[/);
  assert.match(accountPage, /get_my_favorite_business_ids/);
  assert.match(accountPage, /get_my_reviewable_reservations/);
  assert.match(accountPage, /<VerifiedReviewForm/);
  assert.match(reviewForm, /submit_verified_business_review/);
  assert.match(reviewForm, /maxLength=\{1000\}/);
  assert.match(reviewForm, /<fieldset disabled=\{isPending\}>/);
});

test("reviews dependen de la reserva y no rompen cascadas históricas", () => {
  assert.match(migration, /reservation_id uuid not null unique references public\.reservations\(id\) on delete cascade/i);
  assert.doesNotMatch(migration, /reservation_id uuid[^\n]*on delete restrict/i);
});

test("moderación global cubre los cuatro estados, errores y paginación", () => {
  assert.match(globalAdmin, /p_limit: REVIEW_PAGE_SIZE \+ 1/);
  assert.match(globalAdmin, /p_offset: \(reviewPage - 1\) \* REVIEW_PAGE_SIZE/);
  assert.match(globalAdmin, /reviewHasNext/);
  assert.match(globalModeration, /pending[\s\S]*published[\s\S]*rejected[\s\S]*hidden/);
  assert.match(globalModeration, /loadFailed/);
  assert.match(globalModeration, /Paginación de reseñas/);
  assert.match(globalModeration, /reviewHref\(status, currentPage \+ 1, businessPage\)/);
});

test("JSON-LD agrega AggregateRating únicamente cuando existe reputación publicada", () => {
  const business: PlatformBusinessDetail = {
    id: "10000000-0000-4000-8000-000000000001",
    slug: "demo",
    name: "Demo",
    city: "Cajamarca",
    country: "Perú",
    coverImageUrl: null,
    coverAltText: null,
    ratingAverage: 4.7,
    reviewCount: 12,
    venues: [],
  };
  const rated = JSON.stringify(buildBusinessJsonLd(business));
  assert.match(rated, /AggregateRating/);
  assert.match(rated, /"ratingValue":4\.7/);
  assert.match(rated, /"reviewCount":12/);
  const unrated = JSON.stringify(buildBusinessJsonLd({ ...business, ratingAverage: null, reviewCount: 0 }));
  assert.doesNotMatch(unrated, /AggregateRating/);
});
