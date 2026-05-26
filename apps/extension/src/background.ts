/**
 * Service worker — intentionally empty.
 *
 * Earlier versions handled PA_UPLOAD here, but MV3 service workers get
 * suspended after ~30s of inactivity which made the long-running upload
 * hang silently. Uploads now happen directly from the content script
 * (see content.ts → uploadDirect), which lives as long as the tab and
 * doesn't get killed mid-fetch.
 *
 * Keeping the file (even empty) avoids changing the manifest layout.
 */
export {};
