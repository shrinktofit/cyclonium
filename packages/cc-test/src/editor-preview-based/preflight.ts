if (typeof document === 'undefined') {
  throw new Error(`Editor preview-based engine must be used in a browser testing environment like JSDOM or playwright etc.`);
}
