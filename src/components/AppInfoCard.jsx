import { Lock, Zap } from "lucide-react";
import { t } from "../lib/i18n";
import { estimateRhCoins } from "../services/runningHub";

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
          {info.instanceType === "lite" && <span className="lite-label" title={t("appInfo.liteHint")}>Lite</span>}
          {info.accessEncrypted && <span className="encrypted-label"><Lock size={11} /> Private</span>}
        </div>
        <span className="app-info-id">ID {info.webappId}</span>
        {Number(info.avgRunningSeconds) > 0 ? (
          <div className="app-info-cost" title={t("appInfo.estTooltip")}>
            <span>⏱ ~{Math.round(Number(info.avgRunningSeconds))}s</span>
            {info.runningSuccessRate != null && info.runningSuccessRate !== "" && <span>✅ {info.runningSuccessRate}%</span>}
            {estimateRhCoins(info.avgRunningSeconds) ? (
              <span className="app-info-cost-pair">
                🪙 ~{estimateRhCoins(info.avgRunningSeconds)} {t("appInfo.estCoinsUnit")}
                {info.hasPaidModel && <span className="app-info-paid-model" title={t("appInfo.paidModelHint")}> 💲 {t("appInfo.paidModel")}</span>}
              </span>
            ) : info.hasPaidModel ? (
              <span className="app-info-paid-model" title={t("appInfo.paidModelHint")}>💲 {t("appInfo.paidModel")}</span>
            ) : null}
          </div>
        ) : (
          <div className="app-info-cost">
            <span className="app-info-cost-empty">{t("appInfo.noEstimate")}</span>
            {info.hasPaidModel && <span className="app-info-paid-model" title={t("appInfo.paidModelHint")}>💲 {t("appInfo.paidModel")}</span>}
          </div>
        )}
        {info.statisticsInfo ? (
          <div className="app-info-stats">
            {[["useCount", "appInfo.statUses"], ["collectCount", "appInfo.statCollects"], ["likeCount", "appInfo.statLikes"], ["downloadCount", "appInfo.statDownloads"]]
              .filter(([key]) => info.statisticsInfo[key] != null && String(info.statisticsInfo[key]).trim() !== "")
              .map(([key, labelKey]) => (
                <span key={key}><b>{Number(info.statisticsInfo[key]).toLocaleString()}</b> {t(labelKey)}</span>
              ))}
          </div>
        ) : null}
        {!!tags.length && <div className="app-info-tags">{tags.map(tag => <span key={tag}>{tag}</span>)}</div>}
      </div>
    </article>
  );
}
