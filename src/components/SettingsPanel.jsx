import { CheckCircle2, Eye, EyeOff, MonitorCog, Server, X } from "lucide-react";
import { useState } from "react";

export function SettingsPanel({ open, settings, onChange, onSave, onTestComfy, onClose }) {
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  if (!open) return null;

  async function test() {
    setTesting(true);
    setTestMessage("");
    try {
      await onTestComfy();
      setTestMessage("Đã kết nối ComfyUI");
    } catch (error) {
      setTestMessage(error.message || "Không kết nối được ComfyUI");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <aside className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="settings-header"><h2 id="settings-title">Cài đặt</h2><button className="square-button" onClick={onClose} aria-label="Đóng Settings"><X size={18} /></button></div>
        <p>Giao diện và thông tin kết nối được lưu cục bộ trong extension.</p>
        <label className="field">
          <span>Giao diện</span>
          <div className="input-action-row">
            <MonitorCog size={16} />
            <select value={settings.theme || "system"} onChange={event => onChange({ ...settings, theme: event.target.value })}>
              <option value="system">Tự động theo trình duyệt</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
        </label>
        <label className="field">
          <span>ComfyUI URL</span>
          <div className="input-action-row">
            <Server size={16} />
            <input value={settings.comfyUrl} onChange={event => onChange({ ...settings, comfyUrl: event.target.value })} placeholder="http://127.0.0.1:8188" />
            <button onClick={test} disabled={testing}>{testing ? "Đang kiểm tra" : "Kiểm tra"}</button>
          </div>
        </label>
        {testMessage && <div className="connection-result">{testMessage}</div>}
        <label className="field">
          <span>RunningHub API Key</span>
          <div className="input-action-row">
            <input type={showKey ? "text" : "password"} value={settings.runningHubApiKey} onChange={event => onChange({ ...settings, runningHubApiKey: event.target.value })} placeholder="Nhập API key" autoComplete="off" />
            <button className="reveal-button" onClick={() => setShowKey(value => !value)} aria-label={showKey ? "Ẩn API key" : "Hiện API key"}>{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
        </label>
        <div className="settings-note"><CheckCircle2 size={15} /> Extension gọi trực tiếp ComfyUI/RunningHub; không gửi key qua server aPix.</div>
        <button className="primary-button" onClick={onSave}>Lưu Settings</button>
      </aside>
    </div>
  );
}
