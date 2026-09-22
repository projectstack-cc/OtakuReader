import { Component, createEffect } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import { legacyConsumetQuery } from "~/lib/utils/helpers";

// Catch-all for legacy multi-segment Consumet links like
// /manga/consumet::7529/kagurabachi — the unencoded "/" in the old id split
// the URL into extra path segments that the single-segment [id] route can
// never match. Send them to a title search instead of a 404. Normal
// single-segment ids (MangaDex uuids) still match [id], which takes priority
// over a wildcard in the router.
const LegacyMangaLink: Component = () => {
  const params = useParams<{ path: string }>();
  const navigate = useNavigate();

  createEffect(() => {
    const query = legacyConsumetQuery(params.path);
    if (query) {
      navigate(`/search?q=${encodeURIComponent(query)}`, { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  });

  return null;
};

export default LegacyMangaLink;
