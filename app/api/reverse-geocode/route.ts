import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const latitude = Number(request.nextUrl.searchParams.get("latitude"));
  const longitude = Number(request.nextUrl.searchParams.get("longitude"));

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  try {
    const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("localityLanguage", "en");

    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      console.warn("CarFix reverse geocode provider failed", { status: response.status, statusText: response.statusText });
      return NextResponse.json({ error: "Address lookup unavailable" }, { status: 502 });
    }

    const data = await response.json();
    return NextResponse.json({
      address: data.locality || data.localityInfo?.informative?.[0]?.name || "",
      city: data.city || data.locality || "",
      state: data.principalSubdivision || "",
      pincode: data.postcode || "",
      country: data.countryName || ""
    });
  } catch (error) {
    console.warn("CarFix reverse geocode provider unavailable", { message: error instanceof Error ? error.message : "Unknown lookup error" });
    return NextResponse.json({ error: "Address lookup unavailable" }, { status: 502 });
  }
}
