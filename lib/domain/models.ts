export const USER_ROLES = ["CUSTOMER", "OWNER", "ADMIN"] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type EntityStatus = "ACTIVE" | "INACTIVE";
export type ReservationStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";

export type User = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
};

export type Business = {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  status: EntityStatus;
};

export type Venue = {
  id: string;
  businessId: string;
  name: string;
  slug: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: EntityStatus;
};

export type Sport = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  active: boolean;
};

export type Court = {
  id: string;
  venueId: string;
  name: string;
  slug: string;
  sportId: string;
  surface: string | null;
  pricePerHour: number;
  status: EntityStatus;
};

export type Reservation = {
  id: string;
  userId: string;
  courtId: string;
  date: string;
  startTime: string;
  endTime: string;
  price: number;
  status: ReservationStatus;
};

export type PlatformDemoData = {
  users: User[];
  businesses: Business[];
  venues: Venue[];
  courts: Court[];
  reservations: Reservation[];
};
