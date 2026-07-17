"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button, Heading } from "@modules/common/components/ui";
import LocalizedClientLink from "@modules/common/components/localized-client-link";

const slides = [
  { src: "https://picsum.photos/id/26/1920/1080", title: "Quality Essentials, Delivered to Your Door" },
  { src: "https://picsum.photos/id/250/1920/1080", title: "New Arrivals Every Week" },
  { src: "https://picsum.photos/id/24/1920/1080", title: "Free Shipping Over $50" },
];

const AUTOPLAY_MS = 5000;

const Hero = () => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, []);

  const goTo = (index: number) => setCurrent(index);

  return (
    <div className="h-[75vh] w-full border-b border-ui-border-base relative overflow-hidden bg-ui-bg-subtle">
      {/* Slides */}
      {slides.map((slide, index) => (
        <div
          key={slide.src}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            index === current ? "opacity-100 z-0" : "opacity-0 -z-10"
          }`}
        >
          <Image
            src={slide.src}
            alt={slide.title}
            fill
            priority={index === 0}
            className="object-cover"
          />
          {/* optional dark overlay so white text stays readable */}
          <div className="absolute inset-0 bg-black/30" />
        </div>
      ))}

      {/* Content */}
      <div className="absolute inset-0 z-10 flex flex-col justify-center items-center text-center small:p-32 gap-6">
        <span>
          <Heading
            level="h1"
            className="text-3xl leading-10 text-white font-normal mb-4"
          >
            {slides[current].title}
          </Heading>
        </span>
        <LocalizedClientLink href="/store">
          <Button variant="secondary">Shop Now</Button>
        </LocalizedClientLink>
      </div>

      {/* Dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goTo(index)}
            aria-label={`Go to slide ${index + 1}`}
            className={`h-2.5 rounded-full transition-all ${
              index === current ? "w-6 bg-white" : "w-2.5 bg-white/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default Hero;