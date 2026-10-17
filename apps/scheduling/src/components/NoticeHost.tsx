import { useNoticeStore } from "../store/notice-store";

/** The app-wide notice (store/notice-store.ts) — a small modal with OK. */
export default function NoticeHost() {
  const notice = useNoticeStore((s) => s.notice);
  const dismiss = useNoticeStore((s) => s.dismiss);
  if (!notice) return null;
  return (
    <div
      className="modal-scrim"
      onClick={(e) => {
        e.stopPropagation();
        dismiss();
      }}
    >
      <div className="modal-card" role="alertdialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card__title">{notice.title}</div>
        <div className="modal-card__body" style={{ whiteSpace: "pre-line" }}>{notice.message}</div>
        <div className="modal-card__actions">
          <button className="btn-primary" autoFocus onClick={dismiss}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
