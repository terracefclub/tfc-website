import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { PDFPageProxy } from 'pdfjs-dist/types/display/api';
import { queryElement } from '../utilities/query';

GlobalWorkerOptions.workerSrc = '/static/js/pdf.worker.js';

const [width, height] = [160, 240];
const audioColor = 'rgb(96, 165, 250)';

/**
 * Generate a thumbnail of a PDF page in an `HTMLCanvasElement`
 * @param page - A PDF.js abstraction of a document page to render in a canvas
 * @returns a Promise of a canvas element display with the page scaled to fit
 */
async function generateThumbnail(
  page: PDFPageProxy,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('width', width.toString());
  canvas.setAttribute('height', height.toString());

  const vp = page.getViewport({ scale: 1 });
  const scale = Math.min(width / vp.width, height / vp.height);

  const canvasContext = canvas.getContext('2d') as RenderingContext;
  const viewport = page.getViewport({ scale, rotation: 0, dontFlip: false });

  await page.render({ canvasContext, viewport }).promise;
  return canvas;
}

/**
 * Extract a PDF document linked on a media element on the public archive page
 * and render a canvas image of the first page of the document on the element
 * @param item - The element to append an `HTMLCanvasElement` to
 */
async function appendDocumentThumbnail(
  item: HTMLElement,
  { pageNum }: { pageNum: number } = { pageNum: 1 },
): Promise<void> {
  const url = item.getAttribute('data-url');

  if (url) {
    try {
      const doc = await getDocument(url).promise;
      const page = await doc.getPage(pageNum);
      const thumbnailCanvas = await generateThumbnail(page);
      item.appendChild(thumbnailCanvas);
    } catch (error) {
      console.error(error);
    }
  }
}

/**
 * Animate the display and track the audio source of a media archive audio post
 * @param item - The `HTMLElement` with an `HTMLAudioElement` inside
 */
function trackAudio(item: HTMLElement): void {
  const audio = queryElement(item, 'audio', HTMLAudioElement);

  const playEl = queryElement(item, '.play', HTMLElement);
  const pauseEl = queryElement(item, '.pause', HTMLDivElement);
  const elapsedEl = queryElement(item, '.elapsed', HTMLSpanElement);
  const durationEl = queryElement(item, '.duration', HTMLSpanElement);

  const canvas = queryElement(item, 'canvas', HTMLCanvasElement);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const width = canvas.width;
  const height = canvas.height;

  const externalLink = queryElement(item, '.title-box i', HTMLElement);

  /**
   * Convert a numbered timestamp to a digital clock string (more user friendly)
   * @param totalSeconds - a timestamp in seconds to convert
   * @returns a string representation of a timestamp like on a digital clock
   */
  function digitalize(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds < 10 ? 0 : ''}${seconds}`;
  }

  /**
   * Render the elapsed time and audio duration as a typical digitized string
   * @param isUpdate - whether the element is being updated vs first shown
   */
  const displayTime = ({
    isUpdate = false,
  }: { isUpdate?: boolean } = {}): void => {
    elapsedEl.innerHTML = digitalize(audio.currentTime);
    if (isUpdate) durationEl.innerHTML = digitalize(audio.duration);
  };

  /**
   * Redraw the colored, circular time tracker sibling to the `HTMLAudioElement`
   */
  const drawAudioTracker = (): void => {
    const elapsed = audio.currentTime;
    const duration = audio.duration;

    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();
    ctx.fillStyle = audioColor;
    ctx.moveTo(width / 2, height / 2);
    ctx.arc(
      width / 2,
      height / 2,
      width / 2,
      0,
      (elapsed / duration) * Math.PI * 2,
    );
    ctx.lineTo(width / 2, height / 2);
    ctx.fill();
  };

  /**
   * Control source tracking and button display when "Play" is pressed
   */
  const pressPlay = (): void => {
    playEl.classList.add('hidden');
    pauseEl.classList.replace('hidden', 'flex');
    audio.play();
  };

  /**
   * Control source tracking and button display when "Pause" is pressed
   */
  const pressPause = (): void => {
    pauseEl.classList.replace('flex', 'hidden');
    playEl.classList.remove('hidden');
    audio.pause();
  };

  audio.addEventListener('loadedmetadata', () => displayTime());
  audio.addEventListener('timeupdate', () => {
    displayTime({ isUpdate: true });
    drawAudioTracker();

    // fix audio button display when the source finishes playing
    if (audio.currentTime === audio.duration) {
      playEl.classList.remove('hidden');
      pauseEl.classList.replace('flex', 'hidden');
    }
  });
  playEl.addEventListener('click', pressPlay);
  pauseEl.addEventListener('click', pressPause);
  externalLink.addEventListener('click', () =>
    window.open(audio.src, '_blank'),
  );
}

export default function (): void {
  const docs = document.querySelectorAll('.archive-item.pdf');
  const audios = document.querySelectorAll('.archive-item.audio');
  const sliders = document.querySelectorAll('.slider');

  function addSliderHorizontalScrolling(slider: HTMLElement) {
    slider.addEventListener('wheel', (event) => {
      const scrollSpeed = 2;
      const willScrollLeft = event.deltaX < 0 && slider.scrollLeft > 0;
      const willScrollRight =
        event.deltaX > 0 &&
        slider.scrollLeft < slider.scrollWidth - slider.clientWidth;
      if (willScrollLeft || willScrollRight) {
        event.preventDefault();
        slider.scrollBy({
          left: event.deltaX * scrollSpeed,
          behavior: 'smooth',
        });
      }
    });
  }

  // synchronizes async pdf calls
  docs?.forEach(
    async (doc) => await appendDocumentThumbnail(doc as HTMLAnchorElement),
  );
  audios?.forEach((audio) => trackAudio(audio as HTMLAudioElement));
  sliders?.forEach((slider) =>
    addSliderHorizontalScrolling(slider as HTMLDivElement),
  );
}

/* KEEP TO SEE WORKING LEGACY
(async () => {
  const pdfjs = await import('pdfjs-dist/build/pdf');
  const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.entry');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
})();
*/
