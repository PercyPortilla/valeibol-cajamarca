import { NextResponse, type NextRequest } from "next/server";
import {
  LOCAL_DEV_ADMIN_COOKIE,
  isLocalDevAdminAllowed,
  validateLocalDevAdminCredentials,
} from "@/lib/auth/localDev";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: false,
  path: "/",
};

export async function POST(request: NextRequest) {
  const hostname = request.nextUrl.hostname;
  if (!isLocalDevAdminAllowed({ nodeEnv: process.env.NODE_ENV, hostname })) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Solicitud inválida." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!validateLocalDevAdminCredentials({ nodeEnv: process.env.NODE_ENV, hostname, username, password })) {
    return NextResponse.json({ ok: false, message: "Usuario o contraseña incorrectos." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(LOCAL_DEV_ADMIN_COOKIE, "1", {
    ...COOKIE_OPTIONS,
    maxAge: 60 * 60 * 8,
  });
  return response;
}

export async function DELETE(request: NextRequest) {
  const hostname = request.nextUrl.hostname;
  if (!isLocalDevAdminAllowed({ nodeEnv: process.env.NODE_ENV, hostname })) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(LOCAL_DEV_ADMIN_COOKIE, "", {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });
  return response;
}

