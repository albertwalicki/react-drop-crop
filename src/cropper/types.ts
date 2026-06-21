import type { CropArea } from '../types';

/** Imperative handle shared by both cropper engines. */
export interface CropperHandle {
  /** Current crop rectangle in source-image pixels, or null if not ready. */
  getCropArea: () => CropArea | null;
}
