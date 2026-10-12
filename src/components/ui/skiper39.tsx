"use client";

import { gsap } from "gsap";
import React, { useEffect, useRef } from "react";

interface CrowdCanvasProps {
  src: string;
  rows?: number;
  cols?: number;
  /** Size / position classes for the canvas. Defaults to the bottom 90vh of the nearest positioned parent. */
  className?: string;
}

type Stage = { width: number; height: number };
type WalkProps = { startX: number; startY: number; endX: number };
type Peep = {
  image: HTMLImageElement;
  rect: number[];
  width: number;
  height: number;
  x: number;
  y: number;
  anchorY: number;
  scaleX: number;
  walk: gsap.core.Timeline | null;
  render: (ctx: CanvasRenderingContext2D) => void;
};

/**
 * Crowd Canvas, adapted from Skiper UI "Skiper 39" (https://skiper-ui.com), itself inspired by
 * https://codepen.io/zadvorsky/pen/xxwbBQV. Illustration by https://www.openpeeps.com/.
 * Free to use with attribution to Skiper UI.
 */
const CrowdCanvas = ({ src, rows = 15, cols = 7, className = "absolute bottom-0 h-[90vh] w-full" }: CrowdCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // UTILS
    const randomRange = (min: number, max: number) => min + Math.random() * (max - min);
    const randomIndex = (n: number) => randomRange(0, n) | 0;
    const removeRandom = <T,>(a: T[]) => a.splice(randomIndex(a.length), 1)[0];
    const removeItem = <T,>(a: T[], item: T) => a.splice(a.indexOf(item), 1);

    // TWEENS
    const resetPeep = (stage: Stage, peep: Peep): WalkProps => {
      const direction = Math.random() > 0.5 ? 1 : -1;
      const offsetY = 100 - 250 * gsap.parseEase("power2.in")(Math.random());
      const startY = stage.height - peep.height + offsetY;
      let startX: number;
      let endX: number;
      if (direction === 1) {
        startX = -peep.width;
        endX = stage.width;
        peep.scaleX = 1;
      } else {
        startX = stage.width + peep.width;
        endX = 0;
        peep.scaleX = -1;
      }
      peep.x = startX;
      peep.y = startY;
      peep.anchorY = startY;
      return { startX, startY, endX };
    };

    const normalWalk = (peep: Peep, { startY, endX }: WalkProps) => {
      const xDuration = 10;
      const yDuration = 0.25;
      const tl = gsap.timeline();
      tl.timeScale(randomRange(0.5, 1.5));
      tl.to(peep, { duration: xDuration, x: endX, ease: "none" }, 0);
      tl.to(peep, { duration: yDuration, repeat: xDuration / yDuration, yoyo: true, y: startY - 10 }, 0);
      return tl;
    };

    const createPeep = (image: HTMLImageElement, rect: number[]): Peep => {
      const peep: Peep = {
        image,
        rect,
        width: rect[2],
        height: rect[3],
        x: 0,
        y: 0,
        anchorY: 0,
        scaleX: 1,
        walk: null,
        render: (c) => {
          c.save();
          c.translate(peep.x, peep.y);
          c.scale(peep.scaleX, 1);
          c.drawImage(peep.image, peep.rect[0], peep.rect[1], peep.rect[2], peep.rect[3], 0, 0, peep.width, peep.height);
          c.restore();
        },
      };
      return peep;
    };

    // MAIN
    const img = document.createElement("img");
    const stage: Stage = { width: 0, height: 0 };
    const allPeeps: Peep[] = [];
    const availablePeeps: Peep[] = [];
    const crowd: Peep[] = [];
    let disposed = false;

    const removePeepFromCrowd = (peep: Peep) => {
      removeItem(crowd, peep);
      availablePeeps.push(peep);
    };

    const addPeepToCrowd = (): Peep => {
      const peep = removeRandom(availablePeeps);
      const walk = normalWalk(peep, resetPeep(stage, peep)).eventCallback("onComplete", () => {
        if (disposed) return;
        removePeepFromCrowd(peep);
        addPeepToCrowd();
      }) as gsap.core.Timeline;
      peep.walk = walk;
      crowd.push(peep);
      crowd.sort((a, b) => a.anchorY - b.anchorY);
      return peep;
    };

    const initCrowd = () => {
      while (availablePeeps.length) addPeepToCrowd().walk?.progress(Math.random());
    };

    const createPeeps = () => {
      const { naturalWidth: width, naturalHeight: height } = img;
      const rectWidth = width / rows;
      const rectHeight = height / cols;
      for (let i = 0; i < rows * cols; i++) {
        allPeeps.push(createPeep(img, [(i % rows) * rectWidth, ((i / rows) | 0) * rectHeight, rectWidth, rectHeight]));
      }
    };

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(devicePixelRatio, devicePixelRatio);
      crowd.forEach((peep) => peep.render(ctx));
      ctx.restore();
    };

    const resize = () => {
      stage.width = canvas.clientWidth;
      stage.height = canvas.clientHeight;
      canvas.width = stage.width * devicePixelRatio;
      canvas.height = stage.height * devicePixelRatio;
      crowd.forEach((peep) => peep.walk?.kill());
      crowd.length = 0;
      availablePeeps.length = 0;
      availablePeeps.push(...allPeeps);
      initCrowd();
    };

    img.onload = () => {
      if (disposed) return;
      createPeeps();
      resize();
      gsap.ticker.add(render);
    };
    img.src = src;

    window.addEventListener("resize", resize);
    return () => {
      disposed = true;
      window.removeEventListener("resize", resize);
      gsap.ticker.remove(render);
      [...crowd, ...availablePeeps].forEach((peep) => peep.walk?.kill());
    };
  }, [src, rows, cols]);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
};

export { CrowdCanvas };
export default CrowdCanvas;
