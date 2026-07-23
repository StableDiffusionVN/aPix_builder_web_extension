import { Lock, Zap } from "lucide-react";
import { t } from "../lib/i18n";

function coverUrl(info) {
  const cover = info?.covers?.[0];
  if (typeof cover === "string") return cover;
  return cover?.thumbnailUri || cover?.url || "";
}

function tagNames(info) {
  return (info?.tags || [])
    .map(tag => typeof tag === "string" ? tag : tag.nameEn || tag.name)
    .filter(Boolean)
    .slice(0, 3);
}

export function AppInfoCard({ info }) {
  if (!info?.webappName) return null;
  const thumbnail = coverUrl(info);
  const tags = tagNames(info);
  return (
    <article className={`app-info-card ${thumbnail ? "has-cover" : ""}`}>
      {thumbnail && <img className="app-info-cover" src={thumbnail} alt="" />}
      <div className="app-info-body">
        <div className="app-info-title-row">
          <strong>{info.webappName}</strong>
          {info.instanceType === "plus" && <span className="plus-label" title={t("appInfo.plusWarning")}><Zap size={11} /> Plus GPU</span>}
          {info.accessEncrypted && <span className="encrypted-label"><Lock size={11} /> Private</span>}
        </div>
        <span className="app-info-id">ID {info.webappId}</span>
        {!!tags.length && <div className="app-info-tags">{tags.map(tag => <span key={tag}>{tag}</span>)}</div>}
      </div>
    </article>
  );
}
