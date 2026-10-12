import sharp from "sharp";

// The server has crashed natively (0xC0000374 / 0xC0000409) at the start of scans that hash logos, which is
// where sharp (libvips) runs many small jobs at once. Each job using its own pool of threads, plus libvips'
// operation cache, is a known source of instability on Windows. One thread per job and no cache keeps the
// work the same (the scan already runs jobs in parallel) and the images tiny, so speed is barely affected.
sharp.concurrency(1);
sharp.cache(false);

export default sharp;
