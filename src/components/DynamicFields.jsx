import { DYNAMIC_FIELD_TYPES, isDynamicFieldType, resolveDynamicFieldType } from "../lib/dynamicTypes";
import { activeSubFields, isMenuSub, isModelChoiceField, usesRemoteModelDiscovery } from "../lib/catalog";
import { choiceOptionsFromField } from "../lib/menuChoices";
import { SearchableMenuDropdown } from "./SearchableMenuDropdown";
import { ImportPanel } from "./ImportPanel";

const IMAGE_TYPES = ["image", "image_mask", "file"];

export function DynamicFields({ fields, values, onChange, loading, discoveryLoading = false, workflowKind = "", getImageInput = null }) {
  const remoteModelDiscovery = usesRemoteModelDiscovery(workflowKind);
  const visible = fields.filter(field => !IMAGE_TYPES.includes(field.ui.type));
  if (!loading && !discoveryLoading && !visible.length) return null;

  function renderField(field) {
    const type = field.ui.type;
    const choices = field.ui.choices || field.choices || [];
    const modelChoice = isModelChoiceField(field, { kind: workflowKind });
    const choiceField = modelChoice || (
      remoteModelDiscovery
      && ["menu", "menu-sub", "dropdown", "checkpoints", "loras", ...DYNAMIC_FIELD_TYPES].includes(type)
      && choices.length
    );

    if (choiceField) {
      const options = choiceOptionsFromField(field, choices);
      const usesRemoteModels = remoteModelDiscovery && (
        field.ui.dynamic || isDynamicFieldType(type) || Boolean(resolveDynamicFieldType(field))
      );
      return (
        <label className="field" key={field.key}>
          <span>{field.ui.label || field.key}</span>
          <SearchableMenuDropdown
            value={values[field.key] ?? ""}
            options={options}
            onChange={nextValue => onChange(field.key, nextValue)}
            placeholder={`Chọn ${field.ui.label || field.key}…`}
            searchPlaceholder={`Tìm ${field.ui.label || field.key}…`}
            loading={discoveryLoading && usesRemoteModels}
            disabled={discoveryLoading && usesRemoteModels && options.length === 0}
            emptyMessage={usesRemoteModels && discoveryLoading ? "Đang tải…" : "Không có lựa chọn"}
          />
        </label>
      );
    }

    // Seed: giá trị "random_seed" không hiện chữ thô — input trống + placeholder "random" (chữ mờ);
    // xóa trắng input là quay về random mỗi lần chạy (giống SeedField ở app chính).
    if (type === "seed" || field.ui.value === "random_seed") {
      const raw = values[field.key] ?? field.ui.value ?? "";
      const isRandom = raw === "random_seed" || raw === "";
      return (
        <label className="field" key={field.key}>
          <span>{field.ui.label || field.key}</span>
          <input
            type="number"
            min={field.ui.minimum ?? 0}
            max={field.ui.maximum}
            step={field.ui.step ?? 1}
            placeholder="random"
            value={isRandom ? "" : raw}
            onChange={event => {
              if (event.target.value === "") return onChange(field.key, "random_seed");
              const next = Math.trunc(Number(event.target.value));
              onChange(field.key, Number.isFinite(next) ? next : "random_seed");
            }}
          />
        </label>
      );
    }

    if (["int", "float", "slider"].includes(type) && field.ui.display === "slider") {
      return (
        <label className="field range-field" key={field.key}>
          <span>{field.ui.label || field.key}<output>{values[field.key]}</output></span>
          <input type="range" min={field.ui.minimum ?? 0} max={field.ui.maximum ?? 1} step={field.ui.step ?? 0.1} value={values[field.key] ?? field.ui.value ?? 0} onChange={event => onChange(field.key, Number(event.target.value))} />
        </label>
      );
    }
    if (type === "boolean" || type === "checkbox") {
      const checked = (values[field.key] ?? field.ui.value) === true;
      return (
        <div className="field boolean-field" key={field.key}>
          <span>{field.ui.label || field.key}</span>
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            className={`boolean-switch${checked ? " on" : ""}`}
            onClick={() => onChange(field.key, !checked)}
          >
            <span className="boolean-switch-knob" />
          </button>
        </div>
      );
    }
    if (type === "text") {
      return (
        <label className="field" key={field.key}>
          <span>{field.ui.label || field.key}</span>
          <textarea rows={3} value={values[field.key] ?? ""} placeholder="Mô tả thay đổi bạn muốn…" onChange={event => onChange(field.key, event.target.value)} />
        </label>
      );
    }
    return (
      <label className="field" key={field.key}>
        <span>{field.ui.label || field.key}</span>
        <input
          type={["int", "float"].includes(type) ? "number" : "text"}
          min={field.ui.minimum}
          max={field.ui.maximum}
          step={field.ui.step}
          value={values[field.key] ?? ""}
          onChange={event => onChange(field.key, event.target.type === "number" ? Number(event.target.value) : event.target.value)}
        />
      </label>
    );
  }

  function renderRow(field) {
    if (!isMenuSub(field)) return renderField(field);
    // menu-sub: dropdown chọn nhánh + field con đang chọn, bọc trong một khung.
    const subs = activeSubFields(field, values);
    const imageSubs = getImageInput ? subs.filter(sub => IMAGE_TYPES.includes(sub.ui.type)) : [];
    const otherSubs = subs.filter(sub => !IMAGE_TYPES.includes(sub.ui.type));
    return (
      <div className="menu-sub-group" key={field.key}>
        {renderField(field)}
        {(imageSubs.length > 0 || otherSubs.length > 0) && (
          <div className="menu-sub-children">
            {imageSubs.map(sub => {
              // Mỗi field ảnh có slot ảnh riêng — binding lấy từ App theo field key.
              const binding = getImageInput(sub.key);
              return binding ? (
                <ImportPanel key={sub.key} embedded label={sub.ui.label || sub.key} {...binding} />
              ) : null;
            })}
            {otherSubs.map(renderField)}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="tool-section configure-section" aria-labelledby="configure-title">
      <h2 id="configure-title">Thiết lập</h2>
      {(loading || (remoteModelDiscovery && discoveryLoading)) && (
        <div className="inline-status">
          {loading
            ? (workflowKind === "comfy" ? "Đang tải trường dữ liệu…" : "Đang tải trường dữ liệu từ RunningHub…")
            : "Đang quét checkpoint/LoRA từ ComfyUI…"}
        </div>
      )}
      <div className="field-stack">
        {visible.map(renderRow)}
      </div>
    </section>
  );
}
