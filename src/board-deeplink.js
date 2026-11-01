// Agent first-run deep link: the standalone agent sign-in card's third step
// ("Find your first task") cannot open the board in-page (no workspace is
// mounted there), so it lands in the room with ?board=1 and the wall opens the
// work board once on arrival. Pure helpers so the contract stays testable
// without a DOM.
export const BOARD_DEEP_LINK_PARAM = "board";

// Build the arrival URL for the standalone sign-in page's board step.
export function withBoardDeepLink(target) {
  const joiner = target.includes("?") ? "&" : "?";
  return `${target}${joiner}${BOARD_DEEP_LINK_PARAM}=1`;
}

// Only the exact value "1" opens the board; any other spelling is ignored so
// arbitrary links cannot force a modal open.
export function boardDeepLinkWanted(search) {
  return new URLSearchParams(search).get(BOARD_DEEP_LINK_PARAM) === "1";
}

// Strip the deep-link param once honored, keeping every other query entry and
// the hash, so a reload restores the plain room view instead of reopening.
// Accepts absolute or root-relative URLs; parsing uses a fixed dummy base so
// no window is needed.
export function stripBoardDeepLink(href) {
  const url = new URL(href, "https://room.invalid");
  if (url.searchParams.get(BOARD_DEEP_LINK_PARAM) !== "1") return href;
  url.searchParams.delete(BOARD_DEEP_LINK_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}
