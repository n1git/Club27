"use client";

import dynamic from "next/dynamic";

export const LazyLandingPricing = dynamic(() => import("./landing-pricing").then((m) => m.LandingPricing));
